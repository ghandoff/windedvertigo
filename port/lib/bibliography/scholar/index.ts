/**
 * Scholarly-search orchestrator. Fans one query across every configured
 * provider in parallel, dedupes by DOI / PMID / title-year-author, merges into
 * single hits carrying a `sources[]` array (a paper confirmed by multiple
 * databases ranks higher), and stamps a formatted citation on each.
 *
 * Ported in spirit from apps/nordic-sqr-rct/src/lib/article-search/index.js,
 * broadened to our provider set. Adding a provider is additive: implement
 * search() → ScholarHit[] and register it below.
 */

import type { ProviderId, ScholarHit, ScholarSearchResult } from "./types";
import { withCitation } from "./format";
import * as crossref from "./providers/crossref";
import * as openalex from "./providers/openalex";
import * as semanticScholar from "./providers/semantic-scholar";
import * as pubmed from "./providers/pubmed";
import * as arxiv from "./providers/arxiv";
import * as core from "./providers/core";

interface Provider {
  id: ProviderId;
  order: number; // tie-break rank (lower = preferred for our corpus)
  enabled: () => boolean;
  search: (a: { query: string; limit?: number; signal?: AbortSignal }) => Promise<ScholarHit[]>;
}

const PROVIDERS: Provider[] = [
  { id: "crossref", order: 0, enabled: () => true, search: crossref.search },
  { id: "openalex", order: 1, enabled: () => true, search: openalex.search },
  { id: "semantic-scholar", order: 2, enabled: () => true, search: semanticScholar.search },
  { id: "pubmed", order: 3, enabled: () => true, search: pubmed.search },
  { id: "arxiv", order: 4, enabled: () => true, search: arxiv.search },
  { id: "core", order: 5, enabled: core.isEnabled, search: core.search },
];

const ORDER = new Map(PROVIDERS.map((p) => [p.id, p.order]));

export async function searchScholar(
  query: string,
  { limitPerProvider = 8, timeoutMs = 9000 }: { limitPerProvider?: number; timeoutMs?: number } = {},
): Promise<ScholarSearchResult> {
  const active = PROVIDERS.filter((p) => p.enabled());
  if (!query.trim()) {
    return { hits: [], providers: active.map((p) => ({ id: p.id, count: 0 })), errors: [] };
  }

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const settled = await Promise.allSettled(
    active.map((p) => p.search({ query, limit: limitPerProvider, signal: ac.signal })),
  );
  clearTimeout(timer);

  const all: ScholarHit[] = [];
  const providers: ScholarSearchResult["providers"] = [];
  const errors: ScholarSearchResult["errors"] = [];
  settled.forEach((r, i) => {
    const p = active[i];
    if (r.status === "fulfilled") {
      providers.push({ id: p.id, count: r.value.length });
      all.push(...r.value);
    } else {
      const error = r.reason?.message ?? String(r.reason);
      providers.push({ id: p.id, count: 0, error });
      errors.push({ provider: p.id, error });
    }
  });

  const merged = dedupe(all).map(withCitation);
  merged.sort(rank);
  return { hits: merged, providers, errors };
}

function dedupe(hits: ScholarHit[]): ScholarHit[] {
  const byKey = new Map<string, ScholarHit>();
  for (const h of hits) {
    const key = dedupeKey(h);
    const existing = byKey.get(key);
    if (existing) {
      existing.sources = uniq([...(existing.sources ?? [existing.source]), h.source]);
      // fill gaps from the new hit
      if (!existing.abstract && h.abstract) existing.abstract = h.abstract;
      if (!existing.openAccessPdf && h.openAccessPdf) existing.openAccessPdf = h.openAccessPdf;
      if (!existing.doi && h.doi) existing.doi = h.doi;
      if (!existing.pmid && h.pmid) existing.pmid = h.pmid;
      if (!existing.arxivId && h.arxivId) existing.arxivId = h.arxivId;
      if (existing.year == null && h.year != null) existing.year = h.year;
      if (!existing.venue && h.venue) existing.venue = h.venue;
      if (!existing.sourceType && h.sourceType) existing.sourceType = h.sourceType;
      if (existing.citationCount == null && h.citationCount != null) existing.citationCount = h.citationCount;
      if (existing.authors.length === 0 && h.authors.length) existing.authors = h.authors;
    } else {
      byKey.set(key, { ...h, sources: [h.source] });
    }
  }
  return [...byKey.values()];
}

function dedupeKey(h: ScholarHit): string {
  if (h.doi) return `doi:${h.doi.toLowerCase()}`;
  if (h.pmid) return `pmid:${h.pmid}`;
  if (h.arxivId) return `arxiv:${h.arxivId.replace(/v\d+$/, "")}`;
  return `tya:${normTitle(h.title)}::${h.year ?? ""}::${(h.authors[0] ?? "").toLowerCase().slice(0, 24)}`;
}

function normTitle(t: string): string {
  return (t || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

// most-confirmed first; then DOI-present; then preferred provider order
function rank(a: ScholarHit, b: ScholarHit): number {
  const sa = a.sources?.length ?? 1;
  const sb = b.sources?.length ?? 1;
  if (sb !== sa) return sb - sa;
  const da = a.doi ? 0 : 1;
  const db = b.doi ? 0 : 1;
  if (da !== db) return da - db;
  return minOrder(a) - minOrder(b);
}

function minOrder(h: ScholarHit): number {
  const ids = h.sources ?? [h.source];
  return Math.min(...ids.map((s) => ORDER.get(s) ?? 99));
}

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}
