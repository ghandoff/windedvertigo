/** arXiv search provider — preprints (Atom XML; parsed with a minimal extractor). */

import type { ProviderSearchArgs, ScholarHit } from "../types";
import { POLITE_UA, authorName, cleanText, normalizeDoi } from "../format";

const ENDPOINT = "https://export.arxiv.org/api/query";

export async function search({ query, limit = 8, signal }: ProviderSearchArgs): Promise<ScholarHit[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    search_query: `all:${q}`,
    max_results: String(Math.min(Math.max(limit, 1), 20)),
  });
  const res = await fetch(`${ENDPOINT}?${params}`, { signal, headers: { "User-Agent": POLITE_UA } });
  if (!res.ok) {
    if (res.status === 429) return [];
    throw new Error(`arXiv ${res.status}`);
  }
  const xml = await res.text();
  return parseEntries(xml);
}

function tag(block: string, name: string): string | null {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? cleanText(m[1]) : null;
}

function parseEntries(xml: string): ScholarHit[] {
  const hits: ScholarHit[] = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
  for (const e of entries) {
    const title = tag(e, "title");
    if (!title) continue;
    const idUrl = tag(e, "id") ?? "";
    const arxivId = idUrl.match(/abs\/([^v\s]+(?:v\d+)?)/)?.[1] ?? idUrl.split("/").pop() ?? null;
    const published = tag(e, "published");
    const year = published ? Number(published.slice(0, 4)) || null : null;
    const authors = (e.match(/<author>[\s\S]*?<\/author>/g) ?? [])
      .map((a) => authorName(undefined, undefined, tag(a, "name") ?? undefined))
      .filter(Boolean);
    const doi = normalizeDoi(tag(e, "arxiv:doi"));
    const pdf = e.match(/<link[^>]*title="pdf"[^>]*href="([^"]+)"/i)?.[1] ?? (arxivId ? `https://arxiv.org/pdf/${arxivId}` : null);
    hits.push({
      id: `arxiv:${arxivId ?? title.slice(0, 40)}`,
      source: "arxiv",
      title,
      authors,
      year,
      venue: "arXiv",
      doi,
      pmid: null,
      arxivId,
      abstract: tag(e, "summary"),
      sourceType: "Preprint",
      citationCount: null,
      openAccessPdf: pdf,
      url: idUrl || (arxivId ? `https://arxiv.org/abs/${arxivId}` : null),
    });
  }
  return hits;
}
