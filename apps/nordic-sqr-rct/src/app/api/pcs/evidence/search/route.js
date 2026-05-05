/**
 * GET /api/pcs/evidence/search?q=<query>&limit=10
 *
 * Searches multiple article repositories in parallel (PubMed +
 * Semantic Scholar today; CORE / OSF / ClinicalTrials.gov / etc. on
 * the roadmap) and returns a deduplicated, source-tagged result list
 * the operator can review and import as Evidence rows.
 *
 * Capability gate: pcs.evidence:read.
 *
 * Response shape:
 *   {
 *     query: string,
 *     hits:  ArticleHit[]   // deduped + cross-source merged
 *     errors: { provider, error }[]
 *     providers: { id, tier, count, error? }[]
 *   }
 */

import { NextResponse } from 'next/server';
import { requireCapability } from '@/lib/auth/require-capability';
import { searchArticles } from '@/lib/article-search';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence/search' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 25);

  if (!query) return NextResponse.json({ query: '', hits: [], errors: [], providers: [] });

  try {
    const result = await searchArticles({ query, limit });
    return NextResponse.json({ query, ...result });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'search failed' }, { status: 500 });
  }
}
