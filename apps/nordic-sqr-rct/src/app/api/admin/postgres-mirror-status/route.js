import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';
import { notion } from '@/lib/notion';
import { PCS_DB } from '@/lib/pcs-config';

export const runtime = 'nodejs';
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/postgres-mirror-status
 *
 * Path-2 Phase A observability — compare Postgres mirror vs Notion
 * canonical for each PCS table. Powers the /admin/postgres-mirror page.
 *
 * Per table, returns:
 *   - pgCount, notionCount, delta (count diff)
 *   - latestPgEditedAt (max notion_last_edited_at on Postgres rows)
 *   - secondsSinceLatestEdit
 *   - status: 'ok' | 'stale' | 'drifted' | 'no_pg' | 'no_data'
 *
 * Status thresholds:
 *   - 'no_pg':    Postgres table doesn't exist or returned an error
 *   - 'drifted':  |pgCount - notionCount| > 5 OR pgCount === 0 with non-zero notion
 *   - 'stale':    in-sync count, but latestPgEditedAt > 30min ago
 *                 (means recent Notion edits haven't propagated)
 *   - 'ok':       counts match within 5 AND mirror is fresh OR notion has 0 too
 *
 * Capability: requires 'admin' (catch-all) — uses pcs.admin:read which
 * matches the existing pcs-import-jobs admin route pattern.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.admin:read', {
    route: '/api/admin/postgres-mirror-status',
  });
  if (auth.error) return auth.error;

  const sb = getPcsSupabase();
  if (!sb) {
    return NextResponse.json(
      { ok: false, error: 'Supabase not configured' },
      { status: 503 },
    );
  }

  // Each table descriptor: postgres table name + Notion DB id (for live count)
  const tables = [
    { name: 'pcs_evidence', notionDb: PCS_DB.evidenceLibrary },
    { name: 'pcs_claims', notionDb: PCS_DB.claims },
    { name: 'pcs_documents', notionDb: PCS_DB.documents },
    { name: 'pcs_versions', notionDb: PCS_DB.versions },
    { name: 'pcs_evidence_packets', notionDb: PCS_DB.evidencePackets },
    { name: 'pcs_canonical_claims', notionDb: PCS_DB.canonicalClaims },
    { name: 'pcs_ingredients', notionDb: PCS_DB.ingredients },
    { name: 'pcs_core_benefits', notionDb: PCS_DB.coreBenefits },
    { name: 'pcs_references', notionDb: PCS_DB.references },
    { name: 'pcs_wording_variants', notionDb: PCS_DB.wordingVariants },
    { name: 'pcs_formula_lines', notionDb: PCS_DB.formulaLines },
    { name: 'pcs_revision_events', notionDb: PCS_DB.revisionEvents },
    { name: 'pcs_requests', notionDb: PCS_DB.requests },
  ].filter((t) => !!t.notionDb); // skip any table whose env var is missing

  const start = Date.now();
  const results = await Promise.all(
    tables.map(async (t) => {
      const tableStart = Date.now();
      try {
        // Postgres: count + max edit timestamp in parallel
        const [{ count: pgCount, error: countErr }, { data: latestRow, error: latestErr }] =
          await Promise.all([
            sb.from(t.name).select('*', { count: 'exact', head: true }),
            sb
              .from(t.name)
              .select('notion_last_edited_at')
              .order('notion_last_edited_at', { ascending: false })
              .limit(1)
              .maybeSingle(),
          ]);
        if (countErr) {
          return {
            table: t.name,
            status: 'no_pg',
            pgCount: null,
            notionCount: null,
            delta: null,
            latestPgEditedAt: null,
            secondsSinceLatestEdit: null,
            error: countErr.message,
            durationMs: Date.now() - tableStart,
          };
        }
        if (latestErr) {
          // Non-fatal — count still meaningful
          console.warn(`[mirror-status] ${t.name} latest fetch failed: ${latestErr.message}`);
        }

        // Notion: count via head-less query (just the metadata)
        let notionCount = null;
        try {
          // Single-page query is enough to get total — Notion doesn't
          // expose a count endpoint, so we paginate. Cap at 50 pages
          // (5000 rows) — none of our tables exceed that.
          let cursor = undefined;
          let total = 0;
          let pages = 0;
          do {
            const r = await notion.databases.query({
              database_id: t.notionDb,
              page_size: 100,
              start_cursor: cursor,
            });
            total += r.results.length;
            cursor = r.has_more ? r.next_cursor : undefined;
            pages++;
          } while (cursor && pages < 50);
          notionCount = total;
        } catch (err) {
          console.warn(`[mirror-status] ${t.name} Notion count failed: ${err.message}`);
        }

        const latestPgEditedAt = latestRow?.notion_last_edited_at || null;
        const secondsSinceLatestEdit = latestPgEditedAt
          ? Math.floor((Date.now() - new Date(latestPgEditedAt).getTime()) / 1000)
          : null;

        // Status decision
        let status = 'ok';
        const delta = notionCount != null ? pgCount - notionCount : null;
        if (delta !== null && Math.abs(delta) > 5) status = 'drifted';
        else if (pgCount === 0 && notionCount > 0) status = 'drifted';
        else if (
          status === 'ok' &&
          secondsSinceLatestEdit !== null &&
          secondsSinceLatestEdit > 30 * 60 &&
          notionCount > 0
        ) {
          // Only flag stale if there's actually data — empty tables are fine.
          // 30 min threshold matches drift-cron 2-min cadence + buffer.
          status = 'stale';
        }
        if (notionCount === 0 && pgCount === 0) status = 'no_data';

        return {
          table: t.name,
          status,
          pgCount,
          notionCount,
          delta,
          latestPgEditedAt,
          secondsSinceLatestEdit,
          durationMs: Date.now() - tableStart,
        };
      } catch (err) {
        return {
          table: t.name,
          status: 'no_pg',
          pgCount: null,
          notionCount: null,
          delta: null,
          latestPgEditedAt: null,
          secondsSinceLatestEdit: null,
          error: err.message,
          durationMs: Date.now() - tableStart,
        };
      }
    }),
  );

  const summary = {
    ok: results.filter((r) => r.status === 'ok').length,
    no_data: results.filter((r) => r.status === 'no_data').length,
    stale: results.filter((r) => r.status === 'stale').length,
    drifted: results.filter((r) => r.status === 'drifted').length,
    no_pg: results.filter((r) => r.status === 'no_pg').length,
  };

  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - start,
    summary,
    results,
    flagOn: process.env.PCS_READ_FROM_POSTGRES === '1' || process.env.PCS_READ_FROM_POSTGRES === 'true',
  });
}
