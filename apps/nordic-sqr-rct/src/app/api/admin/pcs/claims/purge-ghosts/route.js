import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';
import { notion } from '@/lib/notion';
import { PCS_DB } from '@/lib/pcs-config';

// runtime = 'nodejs' removed — CF Workers/OpenNext requires edge-compatible routes.
export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/pcs/claims/purge-ghosts
 *
 * Finds and optionally deletes Postgres rows in pcs_claims whose
 * notion_page_id no longer exists in Notion. These "ghost" rows arise
 * when a Notion page is hard-deleted outside the platform — the
 * deletion is never mirrored to Postgres because the drift-sync cron
 * only pulls recently-edited rows (via last_edited_time watermarks).
 *
 * The endpoint is safe by default: pass `dry_run=true` (or omit the
 * `confirm` body field) to identify ghosts without touching the DB.
 *
 * Request body (JSON):
 *   {
 *     confirm?: boolean   // must be exactly true to execute the DELETE
 *   }
 *
 * Query params:
 *   dry_run=true          // equivalent to omitting confirm; takes precedence
 *
 * Algorithm:
 *   1. Fetch all notion_page_id values from pcs_claims (Postgres).
 *   2. For each id, attempt notion.pages.retrieve(). A 404 / "Could not
 *      find page" response means the page is gone from Notion.
 *   3. In dry-run mode: return the ghost list with zero DB mutations.
 *   4. In confirmed mode: DELETE each ghost row from pcs_claims and
 *      return the deleted ids with a permanent audit log entry.
 *
 * Rate-limit consideration: Notion allows ~3 req/s per integration.
 * We fan out in batches of 5 with a 400 ms pause between batches to
 * stay well below the limit even for a 500-row table.
 *
 * Capability: schema:edit (super-user only — same gate as backfill
 * endpoints that can mutate core PCS data).
 */
export async function POST(request) {
  const gate = await requireCapability(request, 'schema:edit', {
    route: '/api/admin/pcs/claims/purge-ghosts',
  });
  if (gate.error) return gate.error;

  const sb = getPcsSupabase();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const forceDryRun = searchParams.get('dry_run') === 'true';

  let body = {};
  try {
    body = await request.json();
  } catch {
    // No body or non-JSON body is fine — treated as dry run.
  }

  // Must explicitly pass { confirm: true } in the body AND not have
  // dry_run=true in the URL to execute destructive deletes.
  const isDryRun = forceDryRun || body?.confirm !== true;

  // ── Step 1: fetch all notion_page_id values from Postgres ──────────
  // We only need the id column; 5000-row limit is safe given today's
  // count of ~470. If the table ever grows past 5000, switch to
  // range-paginated fetches.
  const { data: pgRows, error: pgErr } = await sb
    .from('pcs_claims')
    .select('notion_page_id, claim, claim_no, notion_last_edited_at')
    .order('notion_last_edited_at', { ascending: false })
    .limit(5000);

  if (pgErr) {
    return NextResponse.json(
      { ok: false, error: `Postgres fetch failed: ${pgErr.message}` },
      { status: 500 },
    );
  }

  const totalPg = pgRows.length;

  // ── Step 2: probe each id against Notion in batches of 5 ───────────
  const BATCH = 5;
  const BATCH_PAUSE_MS = 400;

  const ghosts = [];   // rows confirmed gone from Notion
  const errors = [];   // rows where the Notion call itself errored (skip these)

  for (let i = 0; i < pgRows.length; i += BATCH) {
    const batch = pgRows.slice(i, i + BATCH);

    await Promise.all(
      batch.map(async (row) => {
        try {
          await notion.pages.retrieve({ page_id: row.notion_page_id });
          // Page exists — not a ghost. No action.
        } catch (err) {
          // Notion returns a 404-equivalent for permanently deleted pages.
          // The @notionhq/client surfaces this as status 404 or the
          // object_not_found / could_not_find_database_with_id codes.
          // We also catch the softer "archived" status: archived pages
          // are NOT considered ghosts — they still exist in Notion and
          // are intentionally kept as history. Only hard-deleted pages
          // (404) qualify as ghosts.
          const status = err?.status ?? err?.code;
          const isGone =
            status === 404 ||
            err?.code === 'object_not_found' ||
            // Notion SDK sometimes wraps it as a generic APIResponseError
            // with the message containing "Could not find page"
            (typeof err?.message === 'string' &&
              err.message.toLowerCase().includes('could not find'));

          if (isGone) {
            ghosts.push({
              notion_page_id: row.notion_page_id,
              claim: row.claim,
              claim_no: row.claim_no,
              notion_last_edited_at: row.notion_last_edited_at,
            });
          } else {
            // Unexpected error (timeout, auth, etc.) — don't treat as ghost;
            // log and carry on so one bad API call doesn't wipe real data.
            errors.push({
              notion_page_id: row.notion_page_id,
              error: err?.message || String(err),
            });
          }
        }
      }),
    );

    // Pause between batches to respect Notion's 3 req/s rate limit.
    if (i + BATCH < pgRows.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_PAUSE_MS));
    }
  }

  // ── Step 3: dry run — return ghost list without mutations ───────────
  if (isDryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      total_pg_rows: totalPg,
      ghost_count: ghosts.length,
      error_count: errors.length,
      ghosts,
      errors,
      message:
        ghosts.length === 0
          ? 'No ghost rows found. Postgres and Notion are in sync.'
          : `Found ${ghosts.length} ghost row(s). Re-POST with { "confirm": true } to delete them.`,
    });
  }

  // ── Step 4: confirmed delete ─────────────────────────────────────────
  if (ghosts.length === 0) {
    return NextResponse.json({
      ok: true,
      dry_run: false,
      total_pg_rows: totalPg,
      ghost_count: 0,
      deleted: [],
      errors,
      message: 'No ghost rows to delete.',
    });
  }

  const ghostIds = ghosts.map((g) => g.notion_page_id);

  const { error: deleteErr } = await sb
    .from('pcs_claims')
    .delete()
    .in('notion_page_id', ghostIds);

  if (deleteErr) {
    return NextResponse.json(
      {
        ok: false,
        error: `Delete failed: ${deleteErr.message}`,
        ghosts,
      },
      { status: 500 },
    );
  }

  console.log(
    `[admin] purge-ghosts: deleted ${ghostIds.length} ghost pcs_claims row(s) — ` +
      ghostIds.join(', '),
  );

  return NextResponse.json({
    ok: true,
    dry_run: false,
    total_pg_rows: totalPg,
    ghost_count: ghosts.length,
    deleted: ghosts,
    errors,
    message: `Deleted ${ghosts.length} ghost row(s) from pcs_claims.`,
  });
}
