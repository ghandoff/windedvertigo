/**
 * Annotated Bibliography data layer.
 *
 * As of the Notion→Supabase migration, the canonical store is Supabase
 * (lib/supabase/bibliography). The Notion read below is retained only for the
 * one-time backfill (queryBibliographyFromNotion). New citations are written to
 * Supabase; the Notion database is kept untouched as a historical archive.
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
import { getBibliography, insertBibliographyRow } from "@/lib/supabase/bibliography";

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

/** One-time backfill source: read ALL entries straight from the Notion database. */
export async function queryBibliographyFromNotion(): Promise<BibliographyEntry[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.bibliography,
    sorts: [{ property: P.year, direction: "descending" }],
    page_size: 100,
    fetchAll: true,
    label: "queryBibliographyFromNotion",
  });
  return result.pages.map(mapPageToEntry);
}

/**
 * Canonical bibliography read — now Supabase-backed. Falls back to Notion only
 * if Supabase is empty (e.g. before the backfill has run), so there's never a
 * citation gap during the migration.
 */
export async function queryBibliography(): Promise<BibliographyEntry[]> {
  try {
    const rows = await getBibliography();
    if (rows.length > 0) return rows;
  } catch (err) {
    console.warn("[bibliography] supabase read failed, falling back to notion:", err);
  }
  return queryBibliographyFromNotion();
}

export interface NewBibliographyEntry {
  fullCitation: string;
  abstract?: string;
  keywords?: string;
  notes?: string;
  topic?: string;
  sourceType?: string;
  year?: number;
  doi?: string;
}

/**
 * File a citation into the canonical (Supabase) Annotated Bibliography —
 * de-duped. Used to auto-file cARL's cited sources. Never throws — a hiccup
 * should not block the finding write that triggered it.
 */
export async function createBibliographyEntry(
  entry: NewBibliographyEntry,
): Promise<{ created: boolean; reason?: string }> {
  // Best-effort structured enrichment: cARL findings usually carry a DOI, so
  // pull clean authors + venue from Crossref to power the author sort + journal
  // facet. Failures here never block the insert — the row files either way.
  let authors: string[] | null = null;
  let firstAuthor: string | null = null;
  let journal: string | null = null;
  let title: string | null = null;
  if (entry.doi) {
    try {
      const { fetchByDoi } = await import("@/lib/bibliography/crossref");
      const meta = await fetchByDoi(entry.doi);
      if (meta) {
        // Crossref returns authors as one formatted string ("Siwatu, K. O., Page, K.").
        // Keep the full string for display; derive the leading surname for A–Z sort.
        const authorStr = meta.authors?.trim() || "";
        authors = authorStr ? [authorStr] : null;
        firstAuthor = authorStr ? authorStr.split(/[,\s]/)[0] || null : null;
        journal = meta.venue ?? null;
        title = meta.title?.trim() || null;
      }
    } catch {
      /* enrichment is best-effort */
    }
  }
  return insertBibliographyRow({
    fullCitation: entry.fullCitation,
    abstract: entry.abstract,
    keywords: entry.keywords,
    notes: entry.notes,
    topic: entry.topic,
    sourceType: entry.sourceType,
    year: entry.year ?? null,
    doi: entry.doi ?? null,
    authors,
    firstAuthor,
    journal,
    title,
  });
}
