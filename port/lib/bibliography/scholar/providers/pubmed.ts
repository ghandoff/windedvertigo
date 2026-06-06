/** PubMed search provider — biomedical (esearch → esummary). Ported from Nordic.
 *  Free; optional NCBI_API_KEY raises the rate limit. */

import type { ProviderSearchArgs, ScholarHit } from "../types";
import { CONTACT_EMAIL, authorName, cleanText, mapType, normalizeDoi } from "../format";

const EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

interface ESummaryDoc {
  uid?: string;
  title?: string;
  authors?: Array<{ name?: string }>;
  pubdate?: string;
  fulljournalname?: string;
  source?: string;
  articleids?: Array<{ idtype?: string; value?: string }>;
  pubtype?: string[];
}

function withKey(u: URL): URL {
  u.searchParams.set("tool", "port-bibliography");
  u.searchParams.set("email", CONTACT_EMAIL);
  if (process.env.NCBI_API_KEY) u.searchParams.set("api_key", process.env.NCBI_API_KEY);
  return u;
}

export async function search({ query, limit = 8, signal }: ProviderSearchArgs): Promise<ScholarHit[]> {
  const q = query.trim();
  if (!q) return [];

  // 1) esearch → PMIDs
  const es = withKey(new URL(`${EUTILS}/esearch.fcgi`));
  es.searchParams.set("db", "pubmed");
  es.searchParams.set("term", q);
  es.searchParams.set("retmax", String(Math.min(Math.max(limit, 1), 20)));
  es.searchParams.set("retmode", "json");
  const sr = await fetch(es.toString(), { signal });
  if (!sr.ok) {
    if (sr.status === 429) return [];
    throw new Error(`PubMed esearch ${sr.status}`);
  }
  const ids: string[] = (await sr.json())?.esearchresult?.idlist ?? [];
  if (ids.length === 0) return [];

  // 2) esummary → metadata
  const sum = withKey(new URL(`${EUTILS}/esummary.fcgi`));
  sum.searchParams.set("db", "pubmed");
  sum.searchParams.set("id", ids.join(","));
  sum.searchParams.set("retmode", "json");
  const mr = await fetch(sum.toString(), { signal });
  if (!mr.ok) {
    if (mr.status === 429) return [];
    throw new Error(`PubMed esummary ${mr.status}`);
  }
  const result = (await mr.json())?.result ?? {};
  return ids.map((id) => toHit(result[id])).filter((h): h is ScholarHit => !!h);
}

function yearFromPubdate(pubdate?: string): number | null {
  const m = (pubdate ?? "").match(/\d{4}/);
  return m ? Number(m[0]) : null;
}

function toHit(d?: ESummaryDoc): ScholarHit | null {
  if (!d?.uid) return null;
  const title = cleanText(d.title);
  if (!title) return null;
  const doi = normalizeDoi(d.articleids?.find((a) => a.idtype === "doi")?.value);
  return {
    id: `pubmed:${d.uid}`,
    source: "pubmed",
    title,
    authors: (d.authors ?? []).map((a) => authorName(undefined, undefined, a.name)).filter(Boolean).slice(0, 8),
    year: yearFromPubdate(d.pubdate),
    venue: d.fulljournalname || d.source || null,
    doi,
    pmid: d.uid,
    abstract: null, // esummary omits abstracts; efetch would add a call — skip for search
    sourceType: mapType(d.pubtype?.[0]),
    citationCount: null,
    openAccessPdf: null,
    url: `https://pubmed.ncbi.nlm.nih.gov/${d.uid}/`,
  };
}
