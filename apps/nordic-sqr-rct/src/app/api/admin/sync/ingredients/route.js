import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { syncRecentIngredientsToPostgres } from '@/lib/pcs-ingredients';

/**
 * POST /api/admin/sync/ingredients
 *
 * Force-syncs Notion → Postgres for the canonical Ingredients table.
 * Used after a backfill that auto-created Notion pages whose
 * mirrorToPostgres calls may have been silently swallowed.
 *
 * Query params:
 *   hours=N   — look back N hours (default: 2; max: 168 = 7 days)
 */
export async function POST(request) {
  const auth = await requireCapability(request, 'pcs.taxonomy:edit', {
    route: '/api/admin/sync/ingredients',
  });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const hours = Math.min(parseInt(searchParams.get('hours') || '2', 10), 168);
  const sinceIso = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const result = await syncRecentIngredientsToPostgres(sinceIso);

  return NextResponse.json({
    sinceIso,
    hours,
    synced: result.mirrored ?? result.count ?? 0,
    fetched: result.fetched ?? 0,
    ...result,
  });
}
