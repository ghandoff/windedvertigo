import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getRevisions } from '@/lib/pcs-revisions';

export const runtime = 'nodejs';
export const maxDuration = 15;
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/pcs/revisions?entityId=<id>&entityType=<type>&limit=<n>
 *
 * Wave 8 Phase A — list the revision history for a single entity.
 * Returns newest first. Guarded by `pcs.revisions:read` (researcher + ra +
 * admin + super-user). No cross-entity or unfiltered listing is exposed
 * — every request must scope to one entityId to keep latency bounded
 * and to keep the surface narrow for future audit-log abuse.
 */
export async function GET(request) {
  const gate = await requireCapability(request, 'pcs.revisions:read', {
    route: '/api/admin/pcs/revisions',
  });
  if (gate.error) return gate.error;

  const { searchParams } = new URL(request.url);
  const entityId = searchParams.get('entityId');
  const entityType = searchParams.get('entityType') || undefined;
  const limitRaw = searchParams.get('limit');
  const limit = limitRaw ? Math.min(Math.max(parseInt(limitRaw, 10) || 50, 1), 100) : 50;

  if (!entityId) {
    return NextResponse.json(
      { error: 'entityId query parameter is required.' },
      { status: 400 },
    );
  }

  try {
    const revisions = await getRevisions({ entityId, entityType, limit });
    return NextResponse.json({ revisions });
  } catch (err) {
    console.error('[api] GET revisions failed:', err);
    return NextResponse.json(
      { error: 'Revision fetch failed', message: err?.message || String(err) },
      { status: 500 },
    );
  }
}
