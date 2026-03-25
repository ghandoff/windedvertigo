/**
 * Activities data layer — tracks touchpoints with contacts.
 */

import {
  getTitle,
  getText,
  getSelect,
  getDate,
  getRelation,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildDate,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, ACTIVITY_PROPS } from "./client";
import type { Activity, ActivityFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildRelationContains,
  buildTitleSearch,
  buildDateAfter,
  buildCompoundFilter,
} from "./filters";

const P = ACTIVITY_PROPS;

function mapPageToActivity(page: PageObjectResponse): Activity {
  const props = page.properties;
  return {
    id: page.id,
    activity: getTitle(props[P.activity]),
    type: getSelect(props[P.type]) as Activity["type"],
    contactIds: getRelation(props[P.contact]),
    organizationIds: getRelation(props[P.organization]),
    eventIds: getRelation(props[P.event]),
    date: getDate(props[P.date]),
    outcome: getSelect(props[P.outcome]) as Activity["outcome"],
    notes: getText(props[P.notes]),
    loggedBy: getText(props[P.loggedBy]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryActivities(
  filters?: ActivityFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.type) nf.push(buildSelectFilter(P.type, filters.type));
    if (filters.outcome) nf.push(buildSelectFilter(P.outcome, filters.outcome));
    if (filters.contactId) nf.push(buildRelationContains(P.contact, filters.contactId));
    if (filters.orgId) nf.push(buildRelationContains(P.organization, filters.orgId));
    if (filters.eventId) nf.push(buildRelationContains(P.event, filters.eventId));
    if (filters.search) nf.push(buildTitleSearch(P.activity, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.activities,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.date, direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryActivities",
  });

  return {
    data: result.pages.map(mapPageToActivity),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

/** Get all activities for a specific contact, sorted newest first. */
export async function getActivitiesForContact(contactId: string) {
  return queryActivities({ contactId }, { pageSize: 100 });
}

/** Get all activities for a specific organization, sorted newest first. */
export async function getActivitiesForOrg(orgId: string) {
  return queryActivities({ orgId }, { pageSize: 100 });
}

export async function getActivity(id: string): Promise<Activity> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToActivity(page);
}

export async function createActivity(
  fields: Partial<Activity> & Pick<Activity, "activity">,
): Promise<Activity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.activity]: buildTitle(fields.activity),
  };

  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.contactIds?.length) properties[P.contact] = buildRelation(fields.contactIds);
  if (fields.organizationIds?.length) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.eventIds?.length) properties[P.event] = buildRelation(fields.eventIds);
  if (fields.date) properties[P.date] = buildDate(fields.date);
  if (fields.outcome) properties[P.outcome] = buildSelect(fields.outcome);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);
  if (fields.loggedBy) properties[P.loggedBy] = buildRichText(fields.loggedBy);

  const page = (await notion.pages.create({
    parent: { database_id: CRM_DB.activities },
    properties,
  })) as PageObjectResponse;

  return mapPageToActivity(page);
}

export async function updateActivity(
  id: string,
  fields: Partial<Activity>,
): Promise<Activity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.activity !== undefined) properties[P.activity] = buildTitle(fields.activity);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.contactIds !== undefined) properties[P.contact] = buildRelation(fields.contactIds);
  if (fields.organizationIds !== undefined) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.eventIds !== undefined) properties[P.event] = buildRelation(fields.eventIds);
  if (fields.date !== undefined) properties[P.date] = buildDate(fields.date);
  if (fields.outcome !== undefined) properties[P.outcome] = buildSelect(fields.outcome);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.loggedBy !== undefined) properties[P.loggedBy] = buildRichText(fields.loggedBy);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToActivity(page);
}

export async function archiveActivity(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
