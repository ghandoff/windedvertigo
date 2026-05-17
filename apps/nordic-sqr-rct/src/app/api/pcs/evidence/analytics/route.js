import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { getPcsSupabase } from '@/lib/supabase-pcs';

/**
 * GET /api/pcs/evidence/analytics
 *
 * Returns cost-savings summary for the Literature Retrieval Tool:
 *   { totalRetrieved, totalSavingsUsd, bySource }
 *
 * totalRetrieved — count of Evidence rows where pdf_platform_retrieved = true
 * totalSavingsUsd — sum of publisher_cost_usd across those rows
 * bySource — breakdown by waterfall tier (unpaywall, zenodo, orcid, etc.)
 *
 * Capability: pcs.evidence:read (all researchers).
 * Cache: 5-minute CDN cache, 10-minute SWR — low-urgency aggregate.
 */
export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', {
    route: '/api/pcs/evidence/analytics',
  });
  if (auth.error) return auth.error;

  const sb = getPcsSupabase();
  if (!sb) {
    return NextResponse.json({ totalRetrieved: 0, totalSavingsUsd: 0, bySource: {} });
  }

  const { data, error } = await sb
    .from('pcs_evidence')
    .select('pdf_source, publisher_cost_usd')
    .eq('pdf_platform_retrieved', true);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const totalRetrieved = data?.length || 0;
  const totalSavingsUsd = data?.reduce((sum, r) => sum + Number(r.publisher_cost_usd || 35), 0) || 0;
  const bySource = {};
  for (const row of data || []) {
    const src = row.pdf_source || 'unknown';
    bySource[src] = (bySource[src] || 0) + 1;
  }

  return NextResponse.json(
    { totalRetrieved, totalSavingsUsd, bySource },
    { headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=600' } },
  );
}
