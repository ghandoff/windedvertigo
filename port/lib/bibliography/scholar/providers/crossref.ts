/** Crossref search provider — broad all-discipline metadata backbone. */

import type { ProviderSearchArgs, ScholarHit } from "../types";
import {
  POLITE_UA,
  authorName,
  cleanText,
  mapType,
  normalizeDoi,
  stripAbstract,
} from "../format";

const BASE = "https://api.crossref.org/works";

interface CrossrefWork {
  DOI?: string;
  URL?: string;
  type?: string;
  title?: string[];
  "container-title"?: string[];
  author?: Array<{ family?: string; given?: string; name?: string }>;
  issued?: { "date-parts"?: number[][] };
  abstract?: string;
  "is-referenced-by-count"?: number;
}

export async function search({ query, limit = 8, signal }: ProviderSearchArgs): Promise<ScholarHit[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    "query.bibliographic": q,
    rows: String(Math.min(Math.max(limit, 1), 20)),
    select: "DOI,URL,title,author,issued,container-title,type,abstract,is-referenced-by-count",
  });
  const res = await fetch(`${BASE}?${params}`, {
    signal,
    headers: { "User-Agent": POLITE_UA, Accept: "application/json" },
  });
  if (!res.ok) {
    if (res.status === 429) return [];
    throw new Error(`Crossref ${res.status}`);
  }
  const json = (await res.json()) as { message?: { items?: CrossrefWork[] } };
  return (json.message?.items ?? []).map(toHit).filter((h): h is ScholarHit => !!h);
}

function toHit(w: CrossrefWork): ScholarHit | null {
  const title = cleanText(w.title?.[0]);
  if (!title) return null;
  const doi = normalizeDoi(w.DOI);
  return {
    id: `crossref:${doi ?? title.slice(0, 40)}`,
    source: "crossref",
    title,
    authors: (w.author ?? []).map((a) => authorName(a.family, a.given, a.name)).filter(Boolean),
    year: w.issued?.["date-parts"]?.[0]?.[0] ?? null,
    venue: cleanText(w["container-title"]?.[0]) || null,
    doi,
    pmid: null,
    abstract: stripAbstract(w.abstract),
    sourceType: mapType(w.type),
    citationCount: w["is-referenced-by-count"] ?? null,
    openAccessPdf: null,
    url: doi ? `https://doi.org/${doi}` : (w.URL ?? null),
  };
}
