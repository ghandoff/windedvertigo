/**
 * Semantic Scholar article-search provider.
 *
 * https://api.semanticscholar.org/graph/v1/paper/search
 * Free, no auth (rate-limited but generous; can request a key for higher
 * limits at semanticscholar.org/product/api).
 *
 * Returns ArticleHit[] in the platform's canonical shape.
 */

const ENDPOINT = 'https://api.semanticscholar.org/graph/v1/paper/search';

const FIELDS = [
  'paperId',
  'title',
  'authors.name',
  'year',
  'venue',
  'externalIds',
  'abstract',
  'openAccessPdf',
  'url',
].join(',');

export async function search({ query, limit = 10, signal }) {
  if (!query || !query.trim()) return [];

  const u = new URL(ENDPOINT);
  u.searchParams.set('query', query);
  u.searchParams.set('limit', String(Math.min(limit, 25)));
  u.searchParams.set('fields', FIELDS);

  const headers = { 'User-Agent': 'nordic-research-platform/1.0 (garrett@windedvertigo.com)' };
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) {
    headers['x-api-key'] = process.env.SEMANTIC_SCHOLAR_API_KEY;
  }

  const res = await fetch(u.toString(), { headers, signal });
  if (!res.ok) {
    if (res.status === 429) {
      // Rate-limited. Return empty list rather than fail the parallel search;
      // the orchestrator surfaces the empty result so PubMed still ships.
      return [];
    }
    throw new Error(`Semantic Scholar ${res.status}`);
  }
  const json = await res.json();
  const items = json?.data || [];
  return items.map(parseHit).filter(Boolean);
}

function parseHit(p) {
  if (!p?.paperId) return null;
  const ext = p.externalIds || {};
  const doi = ext.DOI || null;
  const pmid = ext.PubMed || null;
  return {
    id: `s2:${p.paperId}`,
    source: 'semantic-scholar',
    title: p.title || '',
    authors: (p.authors || []).map((a) => a.name).slice(0, 8),
    year: p.year || null,
    journal: p.venue || null,
    doi,
    pmid,
    abstract: p.abstract || null,
    openAccessPdf: p.openAccessPdf?.url || null,
    url: p.url || (doi ? `https://doi.org/${doi}` : null),
    raw: { paperId: p.paperId, externalIds: ext },
  };
}
