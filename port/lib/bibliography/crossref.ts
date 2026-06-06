/**
 * Crossref metadata lookup — powers DOI auto-fill and the scholarly discovery
 * search. Free, keyless; we identify in the User-Agent to land in Crossref's
 * "polite pool". Pure HTTP + in-code formatting — no LLM, so every call is $0.
 *
 * Outbound fetch from CF Workers to api.crossref.org is fine (the 1010 block we
 * hit last session was inbound to our own zone only).
 */

import type { ScholarHit } from "./scholar/types";

const UA = "port-bibliography/1.0 (mailto:garrett@windedvertigo.com)";
const BASE = "https://api.crossref.org/works";

/** Map a Crossref DOI lookup into the canonical ScholarHit shape (for the
 *  unified discover results + addFromSearchAction). */
export function metaToHit(m: CrossrefMeta): ScholarHit {
  return {
    id: `crossref:${m.doi || m.title.slice(0, 40)}`,
    source: "crossref",
    sources: ["crossref"],
    title: m.title,
    authors: m.authors ? [m.authors] : [],
    year: m.year,
    venue: m.venue,
    doi: m.doi || null,
    pmid: null,
    abstract: m.abstract,
    sourceType: m.sourceType,
    citationCount: m.citationCount,
    openAccessPdf: null,
    url: m.doiUrl || null,
    fullCitation: m.fullCitation,
  };
}

export interface CrossrefMeta {
  fullCitation: string; // formatted APA-ish string ready for the citation field
  title: string;
  authors: string; // "Siwatu, K. O., Page, K., & Hadi, N."
  year: number | null;
  venue: string | null;
  doi: string; // bare, e.g. 10.1080/…
  doiUrl: string; // https://doi.org/…
  sourceType: string | null;
  abstract: string | null;
  citationCount: number | null;
}

// Crossref `message` is loosely typed; we read a handful of known fields.
interface CrossrefWork {
  DOI?: string;
  URL?: string;
  type?: string;
  title?: string[];
  "container-title"?: string[];
  author?: Array<{ family?: string; given?: string; name?: string }>;
  issued?: { "date-parts"?: number[][] };
  volume?: string;
  issue?: string;
  page?: string;
  abstract?: string;
  "is-referenced-by-count"?: number;
}

function normalizeDoi(input: string): string {
  return input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
}

// "Kamau Oginga" → "K. O."; "K." stays "K."
function initials(given?: string): string {
  if (!given) return "";
  return given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(" ");
}

function authorLine(authors?: CrossrefWork["author"]): string {
  if (!authors?.length) return "";
  const names = authors.map((a) => {
    if (a.family) {
      const i = initials(a.given);
      return i ? `${a.family}, ${i}` : a.family;
    }
    return a.name ?? "";
  }).filter(Boolean);
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")}, & ${names[names.length - 1]}`;
}

// Crossref abstracts are JATS XML — strip tags + collapse whitespace.
function stripJats(abstract?: string): string | null {
  if (!abstract) return null;
  const text = abstract
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/^\s*Abstract\s*/i, "")
    .trim();
  return text || null;
}

// Crossref titles/venues can carry inline HTML (e.g. <i>…</i>) — strip + collapse.
function clean(s?: string): string {
  return (s ?? "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function mapType(type?: string): string | null {
  if (!type) return null;
  const m: Record<string, string> = {
    "journal-article": "Journal article",
    "book": "Book",
    "book-chapter": "Book chapter",
    "monograph": "Book",
    "edited-book": "Book",
    "proceedings-article": "Conference paper",
    "report": "Report",
    "dissertation": "Thesis",
    "posted-content": "Preprint",
    "dataset": "Dataset",
    "reference-entry": "Reference entry",
  };
  return m[type] ?? type.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function yearOf(work: CrossrefWork): number | null {
  const y = work.issued?.["date-parts"]?.[0]?.[0];
  return typeof y === "number" ? y : null;
}

// Build a clean APA-ish citation string in code (no LLM).
function formatApa(work: CrossrefWork): string {
  const authors = authorLine(work.author);
  const year = yearOf(work);
  const title = clean(work.title?.[0]);
  const venue = clean(work["container-title"]?.[0]);
  const doi = normalizeDoi(work.DOI ?? "");

  const parts: string[] = [];
  if (authors) parts.push(`${authors}`);
  parts.push(`(${year ?? "n.d."}).`);
  if (title) parts.push(`${title}${/[.?!]$/.test(title) ? "" : "."}`);
  if (venue) {
    let vp = venue;
    if (work.volume) vp += `, ${work.volume}`;
    if (work.issue) vp += `(${work.issue})`;
    if (work.page) vp += `, ${work.page}`;
    parts.push(`${vp}.`);
  }
  if (doi) parts.push(`https://doi.org/${doi}`);
  // join: "Authors (year). Title. Venue, vol(issue), pages. https://doi.org/…"
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

function toMeta(work: CrossrefWork): CrossrefMeta {
  const doi = normalizeDoi(work.DOI ?? "");
  return {
    fullCitation: formatApa(work),
    title: clean(work.title?.[0]),
    authors: authorLine(work.author),
    year: yearOf(work),
    venue: clean(work["container-title"]?.[0]) || null,
    doi,
    doiUrl: doi ? `https://doi.org/${doi}` : (work.URL ?? ""),
    sourceType: mapType(work.type),
    abstract: stripJats(work.abstract),
    citationCount: work["is-referenced-by-count"] ?? null,
  };
}

/** Look up a single work by DOI. Returns null on miss / network error. */
export async function fetchByDoi(doiInput: string): Promise<CrossrefMeta | null> {
  const doi = normalizeDoi(doiInput);
  if (!doi || !doi.startsWith("10.")) return null;
  try {
    const res = await fetch(`${BASE}/${encodeURIComponent(doi)}`, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { message?: CrossrefWork };
    return json.message ? toMeta(json.message) : null;
  } catch {
    return null;
  }
}

/** Free-text bibliographic search. Returns up to `rows` works (best-match order). */
export async function searchWorks(query: string, rows = 8): Promise<CrossrefMeta[]> {
  const q = query.trim();
  if (!q) return [];
  const params = new URLSearchParams({
    "query.bibliographic": q,
    rows: String(Math.min(Math.max(rows, 1), 20)),
    select: "DOI,URL,title,author,issued,container-title,type,volume,issue,page,is-referenced-by-count",
  });
  try {
    const res = await fetch(`${BASE}?${params.toString()}`, {
      signal: AbortSignal.timeout(10000),
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { message?: { items?: CrossrefWork[] } };
    return (json.message?.items ?? []).map(toMeta).filter((m) => m.title);
  } catch {
    return [];
  }
}
