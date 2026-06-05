/**
 * Annotated Bibliography data layer.
 *
 * Fetches citation records from the shared bibliography database.
 * Used by the proposal generator to surface relevant academic citations.
 */

import {
  getTitle,
  getText,
  getSelect,
  getUrl,
  getNumber,
  queryDatabase,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, BIBLIOGRAPHY_PROPS } from "./client";
import type { BibliographyEntry } from "./types";

const P = BIBLIOGRAPHY_PROPS;

function mapPageToEntry(page: PageObjectResponse): BibliographyEntry {
  const props = page.properties;
  return {
    id: page.id,
    fullCitation: getTitle(props[P.fullCitation]),
    abstract: getText(props[P.abstract]),
    keywords: getText(props[P.keywords]),
    notes: getText(props[P.notes]),
    topic: getSelect(props[P.topic]),
    sourceType: getSelect(props[P.sourceType]),
    year: getNumber(props[P.year]),
    doi: getUrl(props[P.doi]),
    publisherLink: getUrl(props[P.publisherLink]),
    citationCount: getNumber(props[P.citationCount]),
  };
}

/**
 * Fetch all bibliography entries (up to 200).
 * Returns them sorted by year descending so newer sources appear first.
 */
export async function queryBibliography(): Promise<BibliographyEntry[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.bibliography,
    sorts: [{ property: P.year, direction: "descending" }],
    page_size: 200,
    label: "queryBibliography",
  });

  return result.pages.map(mapPageToEntry);
}

function trim2000(s: string): string {
  return s.length > 1900 ? s.slice(0, 1900) + "…" : s;
}

function normCitation(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

export interface NewBibliographyEntry {
  fullCitation: string;
  abstract?: string;
  keywords?: string;
  notes?: string;
  topic?: string; // freeform; Notion auto-creates the select option
  sourceType?: string;
  year?: number;
  doi?: string;
}

/**
 * Create a new entry in the canonical Annotated Bibliography — de-duped by
 * full-citation match. Used to auto-file cARL's cited sources (and any other
 * citation the collective logs). Returns whether a row was created. Never
 * throws — a Notion hiccup should not block the finding write that triggered it.
 */
export async function createBibliographyEntry(
  entry: NewBibliographyEntry,
): Promise<{ created: boolean; reason?: string }> {
  const citation = entry.fullCitation?.trim();
  if (!citation) return { created: false, reason: "no citation" };

  try {
    // de-dupe: skip if an entry with the same full citation already exists
    const existing = await queryBibliography();
    const key = normCitation(citation);
    if (existing.some((e) => normCitation(e.fullCitation) === key)) {
      return { created: false, reason: "duplicate" };
    }

    const props: Record<string, unknown> = {
      [P.fullCitation]: { title: [{ text: { content: trim2000(citation) } }] },
    };
    if (entry.abstract) props[P.abstract] = { rich_text: [{ text: { content: trim2000(entry.abstract) } }] };
    if (entry.keywords) props[P.keywords] = { rich_text: [{ text: { content: trim2000(entry.keywords) } }] };
    if (entry.notes) props[P.notes] = { rich_text: [{ text: { content: trim2000(entry.notes) } }] };
    if (entry.topic) props[P.topic] = { select: { name: entry.topic.slice(0, 100) } };
    if (entry.sourceType) props[P.sourceType] = { select: { name: entry.sourceType.slice(0, 100) } };
    if (entry.year) props[P.year] = { number: entry.year };
    if (entry.doi) props[P.doi] = { url: entry.doi };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (notion as any).pages.create({
      parent: { data_source_id: PORT_DB.bibliography },
      properties: props,
    });
    return { created: true };
  } catch (err) {
    console.warn("[bibliography] createBibliographyEntry failed:", err);
    return { created: false, reason: "error" };
  }
}
