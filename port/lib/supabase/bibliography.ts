/**
 * Annotated Bibliography — Supabase data layer (the canonical store, migrated
 * from Notion). Reads back the same `BibliographyEntry` shape the rest of the
 * app expects; writes de-dupe on a normalised citation key.
 */

import { supabase } from "./client";
import type { BibliographyEntry } from "@/lib/notion/types";

export function normCitation(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

// db row → the camelCase BibliographyEntry the app uses
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRow(r: any): BibliographyEntry {
  return {
    id: r.id,
    fullCitation: r.full_citation ?? "",
    abstract: r.abstract ?? "",
    keywords: r.keywords ?? "",
    notes: r.notes ?? "",
    topic: r.topic ?? "",
    sourceType: r.source_type ?? "",
    year: r.year ?? null,
    doi: r.doi ?? null,
    publisherLink: r.publisher_link ?? null,
    citationCount: r.citation_count ?? null,
  };
}

export async function getBibliography(): Promise<BibliographyEntry[]> {
  const { data, error } = await supabase
    .from("bibliography")
    .select("*")
    .order("year", { ascending: false, nullsFirst: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function countBibliography(): Promise<number> {
  const { count, error } = await supabase
    .from("bibliography")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export interface NewBibliographyRow {
  fullCitation: string;
  abstract?: string;
  keywords?: string;
  notes?: string;
  topic?: string;
  sourceType?: string;
  year?: number | null;
  doi?: string | null;
  publisherLink?: string | null;
  scholarLink?: string | null;
  citationCount?: number | null;
  notionPageId?: string | null;
}

/**
 * Insert a bibliography entry, skipping duplicates (by normalised citation).
 * Never throws — returns whether a row was created.
 */
export async function insertBibliographyRow(
  entry: NewBibliographyRow,
): Promise<{ created: boolean; reason?: string }> {
  const citation = entry.fullCitation?.trim();
  if (!citation) return { created: false, reason: "no citation" };

  const { error } = await supabase.from("bibliography").insert({
    full_citation: citation,
    citation_key: normCitation(citation),
    abstract: entry.abstract ?? null,
    keywords: entry.keywords ?? null,
    notes: entry.notes ?? null,
    topic: entry.topic ?? null,
    source_type: entry.sourceType ?? null,
    year: entry.year ?? null,
    doi: entry.doi ?? null,
    publisher_link: entry.publisherLink ?? null,
    scholar_link: entry.scholarLink ?? null,
    citation_count: entry.citationCount ?? null,
    notion_page_id: entry.notionPageId ?? null,
  });

  if (error) {
    if (error.code === "23505") return { created: false, reason: "duplicate" };
    console.warn("[bibliography] insert failed:", error.message);
    return { created: false, reason: "error" };
  }
  return { created: true };
}
