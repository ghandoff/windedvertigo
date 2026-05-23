import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/postgres-mirror-status
 *
 * Postgres health check — row counts and freshness across all PCS and SQR tables.
 *
 * Part 10 migration: the previous implementation compared Postgres vs Notion counts
 * to detect drift. Since Postgres is now the canonical store (Notion no longer
 * an editing surface), this endpoint is a pure Postgres health check: row counts
 * and latest `notion_last_edited_at` timestamps.
 *
 * Capability: pcs.admin:read
 */

const PCS_TABLES = [
  'pcs_documents',
  'pcs_claims',
  'pcs_evidence',
  'pcs_evidence_packets',
  'pcs_canonical_claims',
  'pcs_ingredients',
  'pcs_ingredient_forms',
  'pcs_core_benefits',
  'pcs_versions',
  'pcs_revision_events',
  'pcs_requests',
  'pcs_references',
  'pcs_wording_variants',
  'pcs_formula_lines',
  'pcs_prefixes',
  'pcs_claim_dose_reqs',
  'pcs_import_jobs',
];

const SQR_TABLES = [
  'reviewers',
  'intakes',
  'scores',
];

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

  const allTables = [...PCS_TABLES, ...SQR_TABLES];

  const results = await Promise.all(
    allTables.map(async (table) => {
      try {
        // Count rows
        const { count, error: countErr } = await sb
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (countErr) throw countErr;

        // Latest edit timestamp
        const { data: latestRow, error: latestErr } = await sb
          .from(table)
          .select('notion_last_edited_at')
          .order('notion_last_edited_at', { ascending: false, nullsFirst: false })
          .limit(1)
          .maybeSingle();
        if (latestErr) throw latestErr;

        const latestEditedAt = latestRow?.notion_last_edited_at || null;
        const secondsSinceLatest = latestEditedAt
          ? Math.floor((Date.now() - new Date(latestEditedAt).getTime()) / 1000)
          : null;

        return {
          table,
          rowCount: count ?? 0,
          latestEditedAt,
          secondsSinceLatest,
          status: (count ?? 0) === 0 ? 'empty' : 'ok',
        };
      } catch (err) {
        return {
          table,
          rowCount: null,
          latestEditedAt: null,
          secondsSinceLatest: null,
          status: 'error',
          error: err.message,
        };
      }
    })
  );

  const totalRows = results.reduce((s, r) => s + (r.rowCount || 0), 0);
  const errored = results.filter(r => r.status === 'error');

  return NextResponse.json({
    ok: errored.length === 0,
    checkedAt: new Date().toISOString(),
    totalRows,
    tables: results,
    // Included for context — these are no longer Notion-synced; Postgres is canonical.
    note: 'Postgres is the source of truth. No Notion comparison — Part 10 migration complete.',
    ...(errored.length > 0 ? { errors: errored.map(e => ({ table: e.table, error: e.error })) } : {}),
  });
}
