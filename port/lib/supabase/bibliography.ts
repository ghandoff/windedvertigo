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

// ── richer row shape for the /bibliography page (incl. used_in, source_type) ──

export interface BibliographyRow {
  id: string;
  fullCitation: string;
  abstract: string | null;
  keywords: string | null;
  notes: string | null;
  topic: string | null;
  sourceType: string | null;
  year: number | null;
  doi: string | null;
  publisherLink: string | null;
  scholarLink: string | null;
  citationCount: number | null;
  usedIn: string[];
  pdfUrl: string | null;
  pdfSource: string | null;
  createdAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapFullRow(r: any): BibliographyRow {
  return {
    id: r.id,
    fullCitation: r.full_citation ?? "",
    abstract: r.abstract ?? null,
    keywords: r.keywords ?? null,
    notes: r.notes ?? null,
    topic: r.topic ?? null,
    sourceType: r.source_type ?? null,
    year: r.year ?? null,
    doi: r.doi ?? null,
    publisherLink: r.publisher_link ?? null,
    scholarLink: r.scholar_link ?? null,
    citationCount: r.citation_count ?? null,
    usedIn: r.used_in ?? [],
    pdfUrl: r.pdf_url ?? null,
    pdfSource: r.pdf_source ?? null,
    createdAt: r.created_at,
  };
}

/** Fetch a single row by id (for the PDF serve route + retrieval action). */
export async function getBibliographyRowById(id: string): Promise<BibliographyRow | null> {
  const { data, error } = await supabase.from("bibliography").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? mapFullRow(data) : null;
}

export async function getBibliographyRows(): Promise<BibliographyRow[]> {
  const { data, error } = await supabase
    .from("bibliography")
    .select("*")
    .order("year", { ascending: false, nullsFirst: false })
    .limit(2000);
  if (error) throw error;
  return (data ?? []).map(mapFullRow);
}

export async function updateBibliographyRow(
  id: string,
  fields: {
    fullCitation?: string;
    abstract?: string | null;
    keywords?: string | null;
    notes?: string | null;
    topic?: string | null;
    sourceType?: string | null;
    year?: number | null;
    doi?: string | null;
    publisherLink?: string | null;
    scholarLink?: string | null;
    usedIn?: string[];
    pdfUrl?: string | null;
    pdfSource?: string | null;
  },
): Promise<BibliographyRow> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const patch: Record<string, any> = { updated_at: new Date().toISOString() };
  if (fields.fullCitation !== undefined) {
    patch.full_citation = fields.fullCitation;
    patch.citation_key = normCitation(fields.fullCitation);
  }
  if (fields.abstract !== undefined) patch.abstract = fields.abstract;
  if (fields.keywords !== undefined) patch.keywords = fields.keywords;
  if (fields.notes !== undefined) patch.notes = fields.notes;
  if (fields.topic !== undefined) patch.topic = fields.topic;
  if (fields.sourceType !== undefined) patch.source_type = fields.sourceType;
  if (fields.year !== undefined) patch.year = fields.year;
  if (fields.doi !== undefined) patch.doi = fields.doi;
  if (fields.publisherLink !== undefined) patch.publisher_link = fields.publisherLink;
  if (fields.scholarLink !== undefined) patch.scholar_link = fields.scholarLink;
  if (fields.usedIn !== undefined) patch.used_in = fields.usedIn;
  if (fields.pdfUrl !== undefined) patch.pdf_url = fields.pdfUrl;
  if (fields.pdfSource !== undefined) patch.pdf_source = fields.pdfSource;

  const { data, error } = await supabase
    .from("bibliography")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return mapFullRow(data);
}

export async function deleteBibliographyRow(id: string): Promise<void> {
  const { error } = await supabase.from("bibliography").delete().eq("id", id);
  if (error) throw error;
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
  usedIn?: string[];
}

/**
 * Insert a bibliography entry, skipping duplicates (by normalised citation).
 * Never throws — returns whether a row was created.
 */
export async function insertBibliographyRow(
  entry: NewBibliographyRow,
): Promise<{ created: boolean; reason?: string; id?: string }> {
  const citation = entry.fullCitation?.trim();
  if (!citation) return { created: false, reason: "no citation" };

  const { data, error } = await supabase
    .from("bibliography")
    .insert({
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
      used_in: entry.usedIn ?? [],
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") return { created: false, reason: "duplicate" };
    console.warn("[bibliography] insert failed:", error.message);
    return { created: false, reason: "error" };
  }
  return { created: true, id: data?.id };
}
