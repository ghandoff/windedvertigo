/**
 * Shared formatting helpers for scholarly hits — in-code, no LLM.
 * Used by every provider + the orchestrator to produce a clean APA-ish
 * citation string and normalised fields.
 */

import type { ScholarHit } from "./types";

export const POLITE_UA = "port-bibliography/1.0 (mailto:garrett@windedvertigo.com)";
export const CONTACT_EMAIL = "garrett@windedvertigo.com";

export function normalizeDoi(input?: string | null): string | null {
  if (!input) return null;
  const d = input
    .trim()
    .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "")
    .replace(/^doi:\s*/i, "")
    .trim();
  return d.startsWith("10.") ? d : null;
}

// strip inline HTML/JATS tags + collapse whitespace
export function cleanText(s?: string | null): string {
  return (s ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

export function stripAbstract(s?: string | null): string | null {
  const t = cleanText(s).replace(/^abstract[:\s]*/i, "").trim();
  return t || null;
}

// "Kamau Oginga" → "K. O."
function initials(given?: string): string {
  if (!given) return "";
  return given
    .split(/[\s.]+/)
    .filter(Boolean)
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(" ");
}

/** Format one author "Family, G. I." from a free-form display name or family/given. */
export function authorName(family?: string, given?: string, display?: string): string {
  if (family) {
    const i = initials(given);
    return i ? `${family}, ${i}` : family;
  }
  if (display) {
    // "Manu Kapur" → "Kapur, M."
    const parts = display.trim().split(/\s+/);
    if (parts.length >= 2) {
      const fam = parts[parts.length - 1];
      const giv = parts.slice(0, -1).join(" ");
      return `${fam}, ${initials(giv)}`;
    }
    return display;
  }
  return "";
}

/** Join already-formatted author strings into an APA author list. */
export function joinAuthors(names: string[]): string {
  const a = names.filter(Boolean);
  if (a.length === 0) return "";
  if (a.length === 1) return a[0];
  return `${a.slice(0, -1).join(", ")}, & ${a[a.length - 1]}`;
}

const TYPE_MAP: Record<string, string> = {
  "journal-article": "Journal article",
  article: "Journal article",
  book: "Book",
  "book-chapter": "Book chapter",
  "book-section": "Book chapter",
  monograph: "Book",
  "edited-book": "Book",
  "proceedings-article": "Conference paper",
  proceedings: "Conference paper",
  report: "Report",
  dissertation: "Thesis",
  "posted-content": "Preprint",
  preprint: "Preprint",
  dataset: "Dataset",
  "reference-entry": "Reference entry",
};

export function mapType(type?: string | null): string | null {
  if (!type) return null;
  const k = type.toLowerCase();
  return TYPE_MAP[k] ?? type.replace(/[-_]/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

/** Reconstruct an OpenAlex abstract from its inverted index. */
export function reconstructAbstract(inverted?: Record<string, number[]> | null): string | null {
  if (!inverted) return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(inverted)) {
    for (const p of positions) slots[p] = word;
  }
  const text = slots.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
  return text || null;
}

/** Build a clean APA-ish citation string from a hit's fields. */
export function formatCitation(h: {
  authors: string[];
  year: number | null;
  title: string;
  venue?: string | null;
  doi?: string | null;
}): string {
  const parts: string[] = [];
  const authors = joinAuthors(h.authors);
  if (authors) parts.push(authors);
  parts.push(`(${h.year ?? "n.d."}).`);
  const title = cleanText(h.title);
  if (title) parts.push(`${title}${/[.?!]$/.test(title) ? "" : "."}`);
  if (h.venue) parts.push(`${cleanText(h.venue)}.`);
  if (h.doi) parts.push(`https://doi.org/${h.doi}`);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/** Stamp fullCitation onto a hit. */
export function withCitation(h: ScholarHit): ScholarHit {
  return { ...h, fullCitation: formatCitation(h) };
}
