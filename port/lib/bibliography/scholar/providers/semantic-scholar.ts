/** Semantic Scholar search provider — all-discipline, citation graph, OA links.
 *  Ported from the Nordic adapter; free, no auth (optional key raises limits). */

import type { ProviderSearchArgs, ScholarHit } from "../types";
import { POLITE_UA, authorName, cleanText, normalizeDoi, stripAbstract } from "../format";

const ENDPOINT = "https://api.semanticscholar.org/graph/v1/paper/search";
const FIELDS = ["paperId", "title", "authors.name", "year", "venue", "externalIds", "abstract", "openAccessPdf", "url", "citationCount"].join(",");

interface S2Paper {
  paperId?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  year?: number;
  venue?: string;
  externalIds?: { DOI?: string; PubMed?: string; ArXiv?: string };
  abstract?: string;
  openAccessPdf?: { url?: string };
  url?: string;
  citationCount?: number;
}

export async function search({ query, limit = 8, signal }: ProviderSearchArgs): Promise<ScholarHit[]> {
  const q = query.trim();
  if (!q) return [];
  const u = new URL(ENDPOINT);
  u.searchParams.set("query", q);
  u.searchParams.set("limit", String(Math.min(limit, 25)));
  u.searchParams.set("fields", FIELDS);

  const headers: Record<string, string> = { "User-Agent": POLITE_UA };
  if (process.env.SEMANTIC_SCHOLAR_API_KEY) headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_API_KEY;

  const res = await fetch(u.toString(), { headers, signal });
  if (!res.ok) {
    if (res.status === 429) throw new Error("rate-limited"); // isolated; the others still ship
    throw new Error(`Semantic Scholar ${res.status}`);
  }
  const json = (await res.json()) as { data?: S2Paper[] };
  return (json.data ?? []).map(toHit).filter((h): h is ScholarHit => !!h);
}

function toHit(p: S2Paper): ScholarHit | null {
  if (!p.paperId) return null;
  const title = cleanText(p.title);
  if (!title) return null;
  const ext = p.externalIds ?? {};
  const doi = normalizeDoi(ext.DOI);
  return {
    id: `s2:${p.paperId}`,
    source: "semantic-scholar",
    title,
    authors: (p.authors ?? []).map((a) => authorName(undefined, undefined, a.name)).filter(Boolean).slice(0, 8),
    year: p.year ?? null,
    venue: p.venue || null,
    doi,
    pmid: ext.PubMed ?? null,
    arxivId: ext.ArXiv ?? null,
    abstract: stripAbstract(p.abstract),
    sourceType: null,
    citationCount: p.citationCount ?? null,
    openAccessPdf: p.openAccessPdf?.url ?? null,
    url: p.url || (doi ? `https://doi.org/${doi}` : null),
  };
}
