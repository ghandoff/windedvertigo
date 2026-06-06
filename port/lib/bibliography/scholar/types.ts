/**
 * Canonical shape every scholarly-search provider returns, and what the
 * orchestrator emits after dedupe/merge. Mirrors the Nordic article-search
 * ArticleHit, adapted for our bibliography (no PMID-centric assumptions).
 */

export interface ScholarHit {
  id: string; // "<source>:<provider-local-id>"
  source: ProviderId; // the provider that produced this hit
  sources?: ProviderId[]; // filled by the orchestrator: every provider that found it
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null; // bare, e.g. 10.1080/…
  pmid: string | null;
  arxivId?: string | null;
  abstract: string | null;
  sourceType: string | null; // mapped publication / study type
  citationCount: number | null;
  openAccessPdf: string | null; // a directly-fetchable OA PDF url, when the provider gives one
  url: string | null;
  fullCitation?: string; // stamped by the orchestrator (formatCitation)
}

export type ProviderId =
  | "crossref"
  | "openalex"
  | "semantic-scholar"
  | "pubmed"
  | "arxiv"
  | "core";

export interface ProviderStat {
  id: ProviderId;
  count: number;
  error?: string;
}

export interface ScholarSearchResult {
  hits: ScholarHit[];
  providers: ProviderStat[];
  errors: { provider: ProviderId; error: string }[];
}

export interface ProviderSearchArgs {
  query: string;
  limit?: number;
  signal?: AbortSignal;
}
