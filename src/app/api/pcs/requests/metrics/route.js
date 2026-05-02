/**
 * Wave 4.5.4 — GET /api/pcs/requests/metrics
 *
 * Returns the three point-in-time health metrics used by the /pcs/requests
 * dashboard card and the weekly digest footer.
 *
 * Response is cached for 5 minutes at the framework level via `revalidate`
 * so rapid filter-tab switches on the page don't re-query Notion on every
 * mount. The metrics tolerate mild staleness — they're trend indicators,
 * not commit-path data.
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { computeAllMetrics } from '@/lib/pcs-requests-metrics';

export const revalidate = 300;

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.requests:read', { route: '/api/pcs/requests/metrics' });
  if (auth.error) return auth.error;

  try {
    const metrics = await computeAllMetrics();
    return NextResponse.json(metrics, {
      headers: {
        // Edge/CDN hint. Matches `revalidate` above.
        'Cache-Control': 's-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err) {
    console.error('[metrics] computeAllMetrics failed:', err);
    return NextResponse.json(
      { error: 'Failed to compute metrics', detail: err?.message || String(err) },
      { status: 500 },
    );
  }
}
