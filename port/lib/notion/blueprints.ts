/**
 * Campaign blueprints data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getNumber,
  queryDatabase,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, BLUEPRINT_PROPS } from "./client";
import type { Blueprint, BlueprintFilters, PaginationParams, SortParams, StepChannel } from "./types";
import { buildSelectFilter, buildMultiSelectContains, buildTitleSearch, buildCompoundFilter } from "./filters";

const P = BLUEPRINT_PROPS;

function mapPageToBlueprint(page: PageObjectResponse): Blueprint {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    description: getText(props[P.description]),
    channels: getMultiSelect(props[P.channels]) as StepChannel[],
    category: getSelect(props[P.category]) as Blueprint["category"],
    stepCount: getNumber(props[P.stepCount]) ?? 0,
    totalDays: getNumber(props[P.totalDays]) ?? 0,
    notes: getText(props[P.notes]),
    createdTime: page.created_time,
  };
}

export async function queryBlueprints(
  filters?: BlueprintFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.category) nf.push(buildSelectFilter(P.category, filters.category));
    if (filters.channel) nf.push(buildMultiSelectContains(P.channels, filters.channel));
    if (filters.search) nf.push(buildTitleSearch(P.name, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.blueprints,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.name, direction: "ascending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryBlueprints",
  });

  return {
    data: result.pages.map(mapPageToBlueprint),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getBlueprint(id: string): Promise<Blueprint> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToBlueprint(page);
}

/** Fetch every blueprint for Supabase sync. */
export async function getAllBlueprints(): Promise<Blueprint[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.blueprints,
    sorts: [{ property: P.name, direction: "ascending" }],
    page_size: 200,
    fetchAll: true,
    label: "getAllBlueprints",
  });
  return result.pages.map(mapPageToBlueprint);
}
