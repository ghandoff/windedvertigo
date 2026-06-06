/** OpenAlex search provider — ~250M works, all disciplines, incl. preprints + OA links. */

import type { ProviderSearchArgs, ScholarHit } from "../types";
import { CONTACT_EMAIL, POLITE_UA, authorName, cleanText, mapType, normalizeDoi, reconstructAbstract } from "../format";

const BASE = "https://api.openalex.org/works";

interface OpenAlexWork {
  id?: string;
  title?: string;
  display_name?: string;
  publication_year?: number;
  type?: string;
  doi?: string;
  cited_by_count?: number;
  abstract_inverted_index?: Record<string, number[]>;
  primary_location?: { source?: { display_name?: string } };
  best_oa_location?: { pdf_url?: string | null };
  ids?: { doi?: string; pmid?: string };
  authorships?: Array<{ author?: { display_name?: string } }>;
}

export async function search({ query, limit = 8, signal }: ProviderSearchArgs): Promise<ScholarHit[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    search: q,
    per_page: String(Math.min(Math.max(limit, 1), 25)),
    mailto: CONTACT_EMAIL,
  });
  const res = await fetch(`${BASE}?${params}`, {
    signal,
    headers: { Accept: "application/json", "User-Agent": POLITE_UA },
  });
  if (!res.ok) {
    if (res.status === 429) throw new Error("rate-limited");
    throw new Error(`OpenAlex ${res.status}`);
  }
  const json = (await res.json()) as { results?: OpenAlexWork[] };
  return (json.results ?? []).map(toHit).filter((h): h is ScholarHit => !!h);
}

function pmidFromUrl(pmidUrl?: string): string | null {
  if (!pmidUrl) return null;
  const m = pmidUrl.match(/(\d+)\s*$/);
  return m ? m[1] : null;
}

function toHit(w: OpenAlexWork): ScholarHit | null {
  const title = cleanText(w.title ?? w.display_name);
  if (!title) return null;
  const doi = normalizeDoi(w.doi ?? w.ids?.doi);
  const openalexId = w.id?.split("/").pop() ?? title.slice(0, 40);
  return {
    id: `openalex:${openalexId}`,
    source: "openalex",
    title,
    authors: (w.authorships ?? []).map((a) => authorName(undefined, undefined, a.author?.display_name)).filter(Boolean),
    year: w.publication_year ?? null,
    venue: w.primary_location?.source?.display_name ?? null,
    doi,
    pmid: pmidFromUrl(w.ids?.pmid),
    abstract: reconstructAbstract(w.abstract_inverted_index),
    sourceType: mapType(w.type),
    citationCount: w.cited_by_count ?? null,
    openAccessPdf: w.best_oa_location?.pdf_url ?? null,
    url: doi ? `https://doi.org/${doi}` : (w.id ?? null),
  };
}
