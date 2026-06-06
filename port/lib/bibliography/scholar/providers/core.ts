/** CORE search provider — open-access aggregator. Optional: only used when
 *  CORE_API_KEY is set (the orchestrator skips it otherwise). */

import type { ProviderSearchArgs, ScholarHit } from "../types";
import { authorName, cleanText, normalizeDoi, stripAbstract } from "../format";

const ENDPOINT = "https://api.core.ac.uk/v3/search/works";

interface CoreWork {
  id?: number | string;
  title?: string;
  authors?: Array<{ name?: string }>;
  yearPublished?: number;
  publisher?: string;
  doi?: string;
  abstract?: string;
  downloadUrl?: string;
  citationCount?: number;
}

export function isEnabled(): boolean {
  return !!process.env.CORE_API_KEY;
}

export async function search({ query, limit = 8, signal }: ProviderSearchArgs): Promise<ScholarHit[]> {
  const key = process.env.CORE_API_KEY;
  const q = query.trim();
  if (!key || !q) return [];
  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ q, limit: Math.min(Math.max(limit, 1), 20) }),
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("rate-limited");
    throw new Error(`CORE ${res.status}`);
  }
  const json = (await res.json()) as { results?: CoreWork[] };
  return (json.results ?? []).map(toHit).filter((h): h is ScholarHit => !!h);
}

function toHit(w: CoreWork): ScholarHit | null {
  const title = cleanText(w.title);
  if (!title) return null;
  const doi = normalizeDoi(w.doi);
  return {
    id: `core:${w.id ?? title.slice(0, 40)}`,
    source: "core",
    title,
    authors: (w.authors ?? []).map((a) => authorName(undefined, undefined, a.name)).filter(Boolean).slice(0, 8),
    year: w.yearPublished ?? null,
    venue: w.publisher ?? null,
    doi,
    pmid: null,
    abstract: stripAbstract(w.abstract),
    sourceType: null,
    citationCount: w.citationCount ?? null,
    openAccessPdf: w.downloadUrl ?? null,
    url: doi ? `https://doi.org/${doi}` : (w.downloadUrl ?? null),
  };
}
