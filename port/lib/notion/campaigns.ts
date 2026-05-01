/**
 * Campaigns data layer.
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
} from "@/lib/shared/notion";

import { notion, PORT_DB, CAMPAIGN_PROPS } from "./client";
import type {
  Campaign,
  CampaignFilters,
  AudienceFilter,
  PaginationParams,
  SortParams,
} from "./types";
import {
  buildSelectFilter,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = CAMPAIGN_PROPS;

function parseAudienceFilters(raw: string): AudienceFilter {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as AudienceFilter;
  } catch {
    return {};
  }
}

function mapPageToCampaign(page: PageObjectResponse): Campaign {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    type: getSelect(props[P.type]) as Campaign["type"],
    status: getSelect(props[P.status]) as Campaign["status"],
    eventIds: getRelation(props[P.event]),
    audienceFilters: parseAudienceFilters(getText(props[P.audienceFilters])),
    owner: getText(props[P.owner]),
    startDate: getDate(props[P.startDate]),
    endDate: getDate(props[P.endDate]),
    notes: getText(props[P.notes]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryCampaigns(
  filters?: CampaignFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildSelectFilter(P.status, filters.status));
    if (filters.type) nf.push(buildSelectFilter(P.type, filters.type));
    if (filters.search) nf.push(buildTitleSearch(P.name, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.campaigns,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryCampaigns",
  });

  return {
    data: result.pages.map(mapPageToCampaign),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getCampaign(id: string): Promise<Campaign> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToCampaign(page);
}

export async function createCampaign(
  fields: Partial<Campaign> & Pick<Campaign, "name">,
): Promise<Campaign> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.name]: buildTitle(fields.name),
  };

  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.status) properties[P.status] = buildSelect(fields.status);
  if (fields.eventIds) properties[P.event] = buildRelation(fields.eventIds);
  if (fields.audienceFilters) properties[P.audienceFilters] = buildRichText(JSON.stringify(fields.audienceFilters));
  if (fields.owner) properties[P.owner] = buildRichText(fields.owner);
  if (fields.startDate) properties[P.startDate] = buildDate(fields.startDate);
  if (fields.endDate) properties[P.endDate] = buildDate(fields.endDate);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.campaigns },
    properties,
  })) as PageObjectResponse;

  return mapPageToCampaign(page);
}

export async function updateCampaign(
  id: string,
  fields: Partial<Campaign>,
): Promise<Campaign> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.name !== undefined) properties[P.name] = buildTitle(fields.name);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.status !== undefined) properties[P.status] = buildSelect(fields.status);
  if (fields.eventIds !== undefined) properties[P.event] = buildRelation(fields.eventIds);
  if (fields.audienceFilters !== undefined) properties[P.audienceFilters] = buildRichText(JSON.stringify(fields.audienceFilters));
  if (fields.owner !== undefined) properties[P.owner] = buildRichText(fields.owner);
  if (fields.startDate !== undefined) properties[P.startDate] = buildDate(fields.startDate);
  if (fields.endDate !== undefined) properties[P.endDate] = buildDate(fields.endDate);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToCampaign(page);
}

export async function archiveCampaign(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

/** Get all campaigns — used by the Supabase sync cron. */
export async function getAllCampaigns(): Promise<Campaign[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.campaigns,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 200,
    fetchAll: true,
    label: "getAllCampaigns",
  });
  return result.pages.map(mapPageToCampaign);
}
