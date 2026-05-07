import { NextResponse } from 'next/server';
import { syncRecentEvidenceToPostgres } from '@/lib/pcs-evidence';
import { syncRecentClaimsToPostgres } from '@/lib/pcs-claims';
import { syncRecentDocumentsToPostgres } from '@/lib/pcs-documents';
import { syncRecentEvidencePacketsToPostgres } from '@/lib/pcs-evidence-packets';
import { syncRecentCanonicalClaimsToPostgres } from '@/lib/pcs-canonical-claims';
import { syncRecentIngredientsToPostgres } from '@/lib/pcs-ingredients';
import { syncRecentCoreBenefitsToPostgres } from '@/lib/pcs-core-benefits';
import { syncRecentVersionsToPostgres } from '@/lib/pcs-versions';
import { syncRecentRevisionEventsToPostgres } from '@/lib/pcs-revision-events';
import { syncRecentRequestsToPostgres } from '@/lib/pcs-requests';
import { syncRecentReferencesToPostgres } from '@/lib/pcs-references';
import { syncRecentWordingVariantsToPostgres } from '@/lib/pcs-wording-variants';
import { syncRecentFormulaLinesToPostgres } from '@/lib/pcs-formula-lines';
import { getPcsSupabase } from '@/lib/supabase-pcs';
import { notion } from '@/lib/notion';
import { PCS_DB } from '@/lib/pcs-config';

// runtime = 'nodejs' removed — CF Workers/OpenNext requires edge-compatible routes.
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Module-level state for rate-limited Slack alerts. Imperfect across
// serverless cold starts (each new worker resets these), but adequate
// to suppress the every-2-min flood when drift persists within a warm
// worker's lifetime.
const WORKER_BOOT_AT = Date.now();
const BOOT_GRACE_MS = 5 * 60 * 1000;       // 5 min grace period after boot
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;  // 30 min between alerts
const DRIFT_THRESHOLD = 5;                  // |pg - notion| > 5 → drifted
const NOTION_PAGE_CAP = 50;                 // max pages to paginate per table
let lastAlertAt = 0;

// Map drift-sync table names to PCS_DB keys for Notion DB id lookup.
const TABLE_TO_NOTION_DB = {
  pcs_evidence: 'evidenceLibrary',
  pcs_claims: 'claims',
  pcs_documents: 'documents',
  pcs_evidence_packets: 'evidencePackets',
  pcs_canonical_claims: 'canonicalClaims',
  pcs_ingredients: 'ingredients',
  pcs_core_benefits: 'coreBenefits',
  pcs_versions: 'versions',
  pcs_revision_events: 'revisionEvents',
  pcs_requests: 'requests',
  pcs_references: 'references',
  pcs_wording_variants: 'wordingVariants',
  pcs_formula_lines: 'formulaLines',
};

/**
 * Count rows in a Postgres table via Supabase head+count query.
 * @returns {Promise<number>}
 */
async function countPostgres(sb, tableName) {
  const { count, error } = await sb
    .from(tableName)
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Postgres count failed: ${error.message}`);
  return count || 0;
}

/**
 * Count pages in a Notion DB by paginating with a 100-page cap per
 * fetch. Bails out at NOTION_PAGE_CAP pages of 100 (5,000 rows) to
 * avoid runaway costs on huge DBs — counts beyond the cap are
 * reported as `cap+` and skip the drift comparison.
 * @returns {Promise<{count:number, capped:boolean}>}
 */
async function countNotion(databaseId) {
  let count = 0;
  let cursor;
  let pages = 0;
  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      page_size: 100,
      start_cursor: cursor,
    });
    count += res.results.length;
    cursor = res.has_more ? res.next_cursor : undefined;
    pages += 1;
    if (pages >= NOTION_PAGE_CAP) {
      return { count, capped: true };
    }
  } while (cursor);
  return { count, capped: false };
}

/**
 * Send a succinct drift alert to Slack via SLACK_WEBHOOK_URL.
 * Returns {sent, reason?}.
 */
async function sendDriftAlert({ ts, drifted, errored }) {
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) return { sent: false, reason: 'SLACK_WEBHOOK_URL not set' };

  const lines = [];
  for (const d of drifted) {
    lines.push(
      `• \`${d.table}\`: pg=${d.pgCount} notion=${d.notionCount} Δ=${d.delta >= 0 ? '+' : ''}${d.delta}  ← drifted`,
    );
  }
  for (const e of errored) {
    const msg = (e.error || 'unknown error').slice(0, 160);
    lines.push(`• \`${e.table}\`: ERROR — ${msg}`);
  }

  const base = process.env.NEXT_PUBLIC_SITE_URL || 'https://nordic-sqr-rct.vercel.app';
  const dashLink = `${base}/admin/postgres-mirror`;
  const header = `:warning: Drift detected on Nordic platform (cron run ${ts})`;
  const body = {
    text: header,
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: `*${header}*` } },
      { type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } },
      {
        type: 'actions',
        elements: [
          { type: 'button', text: { type: 'plain_text', text: 'Open dashboard' }, url: dashLink },
        ],
      },
    ],
  };

  try {
    const resp = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      return { sent: false, reason: `Slack webhook ${resp.status}: ${await resp.text()}` };
    }
    return { sent: true };
  } catch (err) {
    return { sent: false, reason: `Slack webhook error: ${err.message}` };
  }
}

/**
 * GET /api/cron/drift-sync
 *
 * Vercel Cron entry point for the Path-2 Phase A drift catcher.
 *
 * Runs every 2 minutes and pulls direct-Notion edits (i.e. Sharon
 * editing a row in Notion's web UI, bypassing our platform's write
 * paths) into Postgres. Uses each table's MAX(notion_last_edited_at)
 * as the watermark, with a 5-minute overlap window to absorb
 * clock-skew between Notion and Postgres.
 *
 * In-platform writes already mirror via mirrorToPostgres() inside
 * createX/updateX — this cron exists specifically to catch the gap
 * where the team edits Notion directly without going through the
 * platform.
 *
 * Authenticated via CRON_SECRET bearer token (Vercel injects this
 * on scheduled cron requests; manual invocations need to send it
 * explicitly).
 */
export async function GET(request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization') || '';
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sb = getPcsSupabase();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  const tables = [
    { name: 'pcs_evidence', sync: syncRecentEvidenceToPostgres },
    { name: 'pcs_claims', sync: syncRecentClaimsToPostgres },
    { name: 'pcs_documents', sync: syncRecentDocumentsToPostgres },
    { name: 'pcs_evidence_packets', sync: syncRecentEvidencePacketsToPostgres },
    { name: 'pcs_canonical_claims', sync: syncRecentCanonicalClaimsToPostgres },
    { name: 'pcs_ingredients', sync: syncRecentIngredientsToPostgres },
    { name: 'pcs_core_benefits', sync: syncRecentCoreBenefitsToPostgres },
    { name: 'pcs_versions', sync: syncRecentVersionsToPostgres },
    { name: 'pcs_revision_events', sync: syncRecentRevisionEventsToPostgres },
    { name: 'pcs_requests', sync: syncRecentRequestsToPostgres },
    { name: 'pcs_references', sync: syncRecentReferencesToPostgres },
    { name: 'pcs_wording_variants', sync: syncRecentWordingVariantsToPostgres },
    { name: 'pcs_formula_lines', sync: syncRecentFormulaLinesToPostgres },
  ];

  // 5-minute overlap window so we don't miss edits that landed during
  // the previous run (Notion's last_edited_time updates can lag a few
  // seconds, and our clock and theirs aren't perfectly aligned).
  const OVERLAP_MS = 5 * 60 * 1000;
  const start = Date.now();
  const results = [];

  for (const { name, sync } of tables) {
    const tableStart = Date.now();
    try {
      // Get current max watermark from Postgres
      const { data: maxRow, error: maxErr } = await sb
        .from(name)
        .select('notion_last_edited_at')
        .order('notion_last_edited_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (maxErr) throw maxErr;

      // Default to 1 hour ago on first run (no rows yet, or first sync)
      const fallback = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const maxAt = maxRow?.notion_last_edited_at || fallback;

      // Subtract overlap to absorb clock skew
      const sinceIso = new Date(new Date(maxAt).getTime() - OVERLAP_MS).toISOString();

      const r = await sync(sinceIso);

      // Drift detection: compare counts between Postgres and Notion.
      // Surfaces rows that exist in only one side (e.g. a Notion-only
      // create that the cron's last_edited_at watermark missed, or a
      // Postgres-only row from a failed reverse-mirror).
      let pgCount = null;
      let notionCount = null;
      let drifted = false;
      let driftError = null;
      let notionCountCapped = false;
      try {
        pgCount = await countPostgres(sb, name);
        const notionDbKey = TABLE_TO_NOTION_DB[name];
        const notionDbId = notionDbKey ? PCS_DB[notionDbKey] : null;
        if (notionDbId) {
          const nc = await countNotion(notionDbId);
          notionCount = nc.count;
          notionCountCapped = nc.capped;
          if (!notionCountCapped) {
            drifted = Math.abs(pgCount - notionCount) > DRIFT_THRESHOLD;
          }
        } else {
          driftError = `No Notion DB id mapping for ${name}`;
        }
      } catch (driftErr) {
        driftError = driftErr.message;
      }

      results.push({
        table: name,
        sinceIso,
        fetched: r.fetched,
        mirrored: r.count,
        maxSeen: r.maxSeen,
        pgCount,
        notionCount,
        notionCountCapped,
        drifted,
        driftError,
        durationMs: Date.now() - tableStart,
      });
    } catch (err) {
      console.error(`[cron:drift-sync] ${name} failed:`, err.message);
      results.push({
        table: name,
        error: err.message,
        durationMs: Date.now() - tableStart,
      });
    }
  }

  // Rate-limited Slack alert: fire when any table is drifted OR errored,
  // but only after the boot grace period and once per cooldown window.
  const now = Date.now();
  const inBootGrace = now - WORKER_BOOT_AT < BOOT_GRACE_MS;
  const inCooldown = now - lastAlertAt < ALERT_COOLDOWN_MS;
  const drifted = results.filter(r => r.drifted);
  const errored = results.filter(r => r.error);
  let alert = { sent: false };
  if ((drifted.length > 0 || errored.length > 0) && !inBootGrace && !inCooldown) {
    alert = await sendDriftAlert({
      ts: new Date().toISOString(),
      drifted,
      errored,
    });
    if (alert.sent) lastAlertAt = now;
  } else if (drifted.length > 0 || errored.length > 0) {
    alert = {
      sent: false,
      reason: inBootGrace ? 'within boot grace period' : 'within cooldown window',
    };
  }

  const totalMirrored = results.reduce((s, r) => s + (r.mirrored || 0), 0);
  if (totalMirrored > 0) {
    console.log(
      `[cron:drift-sync] mirrored ${totalMirrored} rows in ${Date.now() - start}ms`,
    );
  }

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    totalMirrored,
    drifted: drifted.map(d => d.table),
    errored: errored.map(e => e.table),
    alert,
    results,
  });
}
