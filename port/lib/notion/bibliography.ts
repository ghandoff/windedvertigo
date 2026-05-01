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
