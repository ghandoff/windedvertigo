/**
 * Competitive Landscape data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getUrl,
  getRelation,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildMultiSelect,
  buildUrl,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, COMPETITIVE_PROPS } from "./client";
import type { Competitor, CompetitorFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildMultiSelectContains,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = COMPETITIVE_PROPS;

function mapPageToCompetitor(page: PageObjectResponse): Competitor {
  const props = page.properties;
  return {
    id: page.id,
    organisation: getTitle(props[P.organisation]),
    type: getSelect(props[P.type]) as Competitor["type"],
    threatLevel: getSelect(props[P.threatLevel]) as Competitor["threatLevel"],
    quadrantOverlap: getMultiSelect(props[P.quadrantOverlap]) as Competitor["quadrantOverlap"],
    geography: getMultiSelect(props[P.geography]) as Competitor["geography"],
    whatTheyOffer: getText(props[P.whatTheyOffer]),
    whereWvWins: getText(props[P.whereWvWins]),
    relevanceToWv: getText(props[P.relevanceToWv]),
    notes: getText(props[P.notes]),
    url: getUrl(props[P.url]),
    organizationIds: getRelation(props[P.marketMapOrgs]),
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryCompetitors(
  filters?: CompetitorFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.type) nf.push(buildSelectFilter(P.type, filters.type));
    if (filters.threatLevel) nf.push(buildSelectFilter(P.threatLevel, filters.threatLevel));
    if (filters.quadrantOverlap) nf.push(buildMultiSelectContains(P.quadrantOverlap, filters.quadrantOverlap));
    if (filters.geography) nf.push(buildMultiSelectContains(P.geography, filters.geography));
    if (filters.search) nf.push(buildTitleSearch(P.organisation, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.competitive,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryCompetitors",
  });

  return {
    data: result.pages.map(mapPageToCompetitor),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getCompetitor(id: string): Promise<Competitor> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToCompetitor(page);
}

export async function createCompetitor(
  fields: Partial<Competitor> & Pick<Competitor, "organisation">,
): Promise<Competitor> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.organisation]: buildTitle(fields.organisation),
  };

  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.threatLevel) properties[P.threatLevel] = buildSelect(fields.threatLevel);
  if (fields.quadrantOverlap) properties[P.quadrantOverlap] = buildMultiSelect(fields.quadrantOverlap);
  if (fields.geography) properties[P.geography] = buildMultiSelect(fields.geography);
  if (fields.whatTheyOffer) properties[P.whatTheyOffer] = buildRichText(fields.whatTheyOffer);
  if (fields.whereWvWins) properties[P.whereWvWins] = buildRichText(fields.whereWvWins);
  if (fields.relevanceToWv) properties[P.relevanceToWv] = buildRichText(fields.relevanceToWv);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);
  if (fields.url) properties[P.url] = buildUrl(fields.url);
  if (fields.organizationIds) properties[P.marketMapOrgs] = buildRelation(fields.organizationIds);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.competitive },
    properties,
  })) as PageObjectResponse;

  return mapPageToCompetitor(page);
}

export async function updateCompetitor(
  id: string,
  fields: Partial<Competitor>,
): Promise<Competitor> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.organisation !== undefined) properties[P.organisation] = buildTitle(fields.organisation);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.threatLevel !== undefined) properties[P.threatLevel] = buildSelect(fields.threatLevel);
  if (fields.quadrantOverlap !== undefined) properties[P.quadrantOverlap] = buildMultiSelect(fields.quadrantOverlap);
  if (fields.geography !== undefined) properties[P.geography] = buildMultiSelect(fields.geography);
  if (fields.whatTheyOffer !== undefined) properties[P.whatTheyOffer] = buildRichText(fields.whatTheyOffer);
  if (fields.whereWvWins !== undefined) properties[P.whereWvWins] = buildRichText(fields.whereWvWins);
  if (fields.relevanceToWv !== undefined) properties[P.relevanceToWv] = buildRichText(fields.relevanceToWv);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.url !== undefined) properties[P.url] = buildUrl(fields.url);
  if (fields.organizationIds !== undefined) properties[P.marketMapOrgs] = buildRelation(fields.organizationIds);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToCompetitor(page);
}

export async function archiveCompetitor(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
