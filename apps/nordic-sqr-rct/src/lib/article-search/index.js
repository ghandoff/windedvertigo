/**
 * Article-search orchestrator.
 *
 * Runs all configured providers in parallel against the same query,
 * collects ArticleHits, and de-duplicates by DOI / PMID / normalized
 * title-year-author key. Returns the merged list with a per-result
 * `sources` array showing which providers found it (so a hit confirmed
 * by both PubMed and Semantic Scholar is more trustworthy than one
 * found by only one).
 *
 * Tier system per the user's stated methodology:
 *   Tier 1 (today): PubMed, Semantic Scholar — peer-reviewed,
 *     citation-backed, free authoritative APIs.
 *   Tier 2 (future): CORE, OSF, ClinicalTrials.gov — pre-prints,
 *     pre-registrations, open-access aggregators.
 *   Tier 3 (future): Google Scholar, ResearchGate — broad coverage but
 *     no public API; requires scraping or a partnership.
 *
 * Adding a Tier 2/3 provider is an additive change — implement
 * `search({query, limit, signal})` returning ArticleHit[] and add it
 * to PROVIDERS.
 */

import * as pubmed from './providers/pubmed.js';
import * as semanticScholar from './providers/semantic-scholar.js';

const PROVIDERS = [
  { id: 'pubmed', tier: 1, search: pubmed.search },
  { id: 'semantic-scholar', tier: 1, search: semanticScholar.search },
];

export async function searchArticles({ query, limit = 10, timeoutMs = 8000 }) {
  if (!query || !query.trim()) {
    return { hits: [], errors: [], providers: PROVIDERS.map((p) => ({ id: p.id, tier: p.tier, count: 0 })) };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);

  const results = await Promise.allSettled(
    PROVIDERS.map((p) => p.search({ query, limit, signal: ac.signal })),
  );
  clearTimeout(timer);

  const hits = [];
  const errors = [];
  const providerStats = [];
  for (const [i, r] of results.entries()) {
    const p = PROVIDERS[i];
    if (r.status === 'fulfilled') {
      providerStats.push({ id: p.id, tier: p.tier, count: r.value.length });
      hits.push(...r.value);
    } else {
      providerStats.push({ id: p.id, tier: p.tier, count: 0, error: r.reason?.message || String(r.reason) });
      errors.push({ provider: p.id, error: r.reason?.message || String(r.reason) });
    }
  }

  // De-duplicate. A single paper indexed in multiple providers gets
  // merged into one hit with `sources: ['pubmed', 'semantic-scholar']`.
  const merged = dedupeHits(hits);

  // Sort: most-confirmed first (more sources), then ranked by source order
  // (PubMed before Semantic Scholar by default).
  merged.sort((a, b) => {
    if (b.sources.length !== a.sources.length) return b.sources.length - a.sources.length;
    const aPm = a.sources.includes('pubmed') ? 0 : 1;
    const bPm = b.sources.includes('pubmed') ? 0 : 1;
    return aPm - bPm;
  });

  return { hits: merged, errors, providers: providerStats };
}

function dedupeHits(hits) {
  const byKey = new Map();
  for (const h of hits) {
    const key = dedupeKey(h);
    if (byKey.has(key)) {
      const existing = byKey.get(key);
      // Merge: prefer the more-complete record but track all sources.
      existing.sources = uniq([...existing.sources, h.source]);
      // Fill in fields from the new hit if existing was missing them
      if (!existing.abstract && h.abstract) existing.abstract = h.abstract;
      if (!existing.openAccessPdf && h.openAccessPdf) existing.openAccessPdf = h.openAccessPdf;
      if (!existing.doi && h.doi) existing.doi = h.doi;
      if (!existing.pmid && h.pmid) existing.pmid = h.pmid;
      if (!existing.year && h.year) existing.year = h.year;
      if (!existing.journal && h.journal) existing.journal = h.journal;
      // PubMed wins evidenceType — it's MeSH-classified. Semantic Scholar
      // doesn't return publication types so this only fires when PubMed
      // is the second-arrival on a Semantic-Scholar-first hit.
      if (!existing.evidenceType && h.evidenceType) existing.evidenceType = h.evidenceType;
    } else {
      byKey.set(key, { ...h, sources: [h.source] });
    }
  }
  return [...byKey.values()];
}

function dedupeKey(h) {
  if (h.doi) return `doi:${h.doi.toLowerCase()}`;
  if (h.pmid) return `pmid:${h.pmid}`;
  return `tya:${normalizeTitle(h.title)}::${h.year ?? ''}::${(h.authors?.[0] || '').toLowerCase().slice(0, 24)}`;
}

function normalizeTitle(t) {
  return (t || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function uniq(arr) {
  return [...new Set(arr)];
}

export { PROVIDERS };
