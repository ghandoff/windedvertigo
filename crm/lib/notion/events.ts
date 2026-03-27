/**
 * Events & Conferences data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getDate,
  getUrl,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildMultiSelect,
  buildDate,
  buildUrl,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, EVENT_PROPS } from "./client";
import type { CrmEvent, EventFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildMultiSelectContains,
  buildTitleSearch,
  buildDateAfter,
  buildCompoundFilter,
} from "./filters";

const P = EVENT_PROPS;

function mapPageToEvent(page: PageObjectResponse): CrmEvent {
  const props = page.properties;
  return {
    id: page.id,
    event: getTitle(props[P.event]),
    type: getSelect(props[P.type]) as CrmEvent["type"],
    eventDates: getDate(props[P.eventDates]),
    proposalDeadline: getDate(props[P.proposalDeadline]),
    frequency: getSelect(props[P.frequency]) as CrmEvent["frequency"],
    location: getText(props[P.location]),
    estAttendance: getText(props[P.estAttendance]),
    registrationCost: getText(props[P.registrationCost]),
    quadrantRelevance: getMultiSelect(props[P.quadrantRelevance]) as CrmEvent["quadrantRelevance"],
    bdSegments: getText(props[P.bdSegments]),
    whoShouldAttend: getMultiSelect(props[P.whoShouldAttend]) as CrmEvent["whoShouldAttend"],
    whyItMatters: getText(props[P.whyItMatters]),
    notes: getText(props[P.notes]),
    url: getUrl(props[P.url]),
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryEvents(
  filters?: EventFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.type) nf.push(buildSelectFilter(P.type, filters.type));
    if (filters.quadrantRelevance) nf.push(buildMultiSelectContains(P.quadrantRelevance, filters.quadrantRelevance));
    if (filters.whoShouldAttend) nf.push(buildMultiSelectContains(P.whoShouldAttend, filters.whoShouldAttend));
    if (filters.upcoming) nf.push(buildDateAfter(P.eventDates, new Date().toISOString().split("T")[0]));
    if (filters.search) nf.push(buildTitleSearch(P.event, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.events,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.eventDates, direction: "ascending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryEvents",
  });

  return {
    data: result.pages.map(mapPageToEvent),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getEvent(id: string): Promise<CrmEvent> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToEvent(page);
}

export async function createEvent(
  fields: Partial<CrmEvent> & Pick<CrmEvent, "event">,
): Promise<CrmEvent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.event]: buildTitle(fields.event),
  };

  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.eventDates) properties[P.eventDates] = buildDate(fields.eventDates);
  if (fields.proposalDeadline) properties[P.proposalDeadline] = buildDate(fields.proposalDeadline);
  if (fields.frequency) properties[P.frequency] = buildSelect(fields.frequency);
  if (fields.location) properties[P.location] = buildRichText(fields.location);
  if (fields.estAttendance) properties[P.estAttendance] = buildRichText(fields.estAttendance);
  if (fields.registrationCost) properties[P.registrationCost] = buildRichText(fields.registrationCost);
  if (fields.quadrantRelevance) properties[P.quadrantRelevance] = buildMultiSelect(fields.quadrantRelevance);
  if (fields.bdSegments) properties[P.bdSegments] = buildRichText(fields.bdSegments);
  if (fields.whoShouldAttend) properties[P.whoShouldAttend] = buildMultiSelect(fields.whoShouldAttend);
  if (fields.whyItMatters) properties[P.whyItMatters] = buildRichText(fields.whyItMatters);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);
  if (fields.url) properties[P.url] = buildUrl(fields.url);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.events },
    properties,
  })) as PageObjectResponse;

  return mapPageToEvent(page);
}

export async function updateEvent(
  id: string,
  fields: Partial<CrmEvent>,
): Promise<CrmEvent> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.event !== undefined) properties[P.event] = buildTitle(fields.event);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.eventDates !== undefined) properties[P.eventDates] = buildDate(fields.eventDates);
  if (fields.proposalDeadline !== undefined) properties[P.proposalDeadline] = buildDate(fields.proposalDeadline);
  if (fields.frequency !== undefined) properties[P.frequency] = buildSelect(fields.frequency);
  if (fields.location !== undefined) properties[P.location] = buildRichText(fields.location);
  if (fields.estAttendance !== undefined) properties[P.estAttendance] = buildRichText(fields.estAttendance);
  if (fields.registrationCost !== undefined) properties[P.registrationCost] = buildRichText(fields.registrationCost);
  if (fields.quadrantRelevance !== undefined) properties[P.quadrantRelevance] = buildMultiSelect(fields.quadrantRelevance);
  if (fields.bdSegments !== undefined) properties[P.bdSegments] = buildRichText(fields.bdSegments);
  if (fields.whoShouldAttend !== undefined) properties[P.whoShouldAttend] = buildMultiSelect(fields.whoShouldAttend);
  if (fields.whyItMatters !== undefined) properties[P.whyItMatters] = buildRichText(fields.whyItMatters);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.url !== undefined) properties[P.url] = buildUrl(fields.url);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToEvent(page);
}

export async function archiveEvent(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}
