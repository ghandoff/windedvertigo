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
import { findEvidenceByIdentifier } from '@/lib/pcs-evidence';

export async function GET(request) {
  const auth = await requireCapability(request, 'pcs.evidence:read', { route: '/api/pcs/evidence/search' });
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') || '').trim();
  const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 25);

  if (!query) return NextResponse.json({ query: '', hits: [], errors: [], providers: [] });

  try {
    const result = await searchArticles({ query, limit });

    // 2026-05-05 — Cross-check each hit against the Evidence Library so
    // the panel can render "✓ In library" instead of "+ Add to Evidence"
    // for articles already saved. Lookup is per-hit but parallelized
    // and falls back to null on Notion failure (advisory only — a search
    // result that fails the dedup lookup is still shown as save-able).
    const hits = await Promise.all(
      (result.hits || []).map(async (h) => {
        if (!h.doi && !h.pmid) return h;
        try {
          const existing = await findEvidenceByIdentifier({ doi: h.doi, pmid: h.pmid });
          return existing
            ? { ...h, existingEvidenceId: existing.id, existingEvidenceName: existing.name }
            : h;
        } catch {
          return h;
        }
      }),
    );

    return NextResponse.json({ query, ...result, hits });
  } catch (err) {
    return NextResponse.json({ error: err?.message || 'search failed' }, { status: 500 });
  }
}
