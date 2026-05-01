/**
 * Cycles data layer — studio mode sprint windows.
 *
 * 2-week focus periods for harbour product work.
 * Each cycle belongs to a project and contains work items via the project relation.
 */

import {
  getTitle,
  getSelect,
  getDate,
  getText,
  getRelation,
  queryDatabase,
  buildTitle,
  buildSelect,
  buildDate,
  buildRichText,
  buildRelation,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, CYCLE_PROPS } from "./client";
import type { Cycle, CycleFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildRelationContains,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = CYCLE_PROPS;

function mapPageToCycle(page: PageObjectResponse): Cycle {
  const props = page.properties;
  return {
    id: page.id,
    cycle: getTitle(props[P.cycle]),
    startDate: getDate(props[P.startDate]),
    endDate: getDate(props[P.endDate]),
    projectIds: getRelation(props[P.project]),
    status: getSelect(props[P.status]) as Cycle["status"],
    goal: getText(props[P.goal]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryCycles(
  filters?: CycleFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildSelectFilter(P.status, filters.status));
    if (filters.projectId) nf.push(buildRelationContains(P.project, filters.projectId));
    if (filters.search) nf.push(buildTitleSearch(P.cycle, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.cycles,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.startDate, direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryCycles",
  });

  return {
    data: result.pages.map(mapPageToCycle),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getCycle(id: string): Promise<Cycle> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToCycle(page);
}

export async function createCycle(
  fields: Partial<Cycle> & Pick<Cycle, "cycle">,
): Promise<Cycle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.cycle]: buildTitle(fields.cycle),
  };

  if (fields.status) properties[P.status] = buildSelect(fields.status);
  if (fields.startDate) properties[P.startDate] = buildDate(fields.startDate);
  if (fields.endDate) properties[P.endDate] = buildDate(fields.endDate);
  if (fields.projectIds?.length) properties[P.project] = buildRelation(fields.projectIds);
  if (fields.goal) properties[P.goal] = buildRichText(fields.goal);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.cycles },
    properties,
  })) as PageObjectResponse;

  return mapPageToCycle(page);
}

export async function updateCycle(
  id: string,
  fields: Partial<Cycle>,
): Promise<Cycle> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.cycle !== undefined) properties[P.cycle] = buildTitle(fields.cycle);
  if (fields.status !== undefined) properties[P.status] = buildSelect(fields.status);
  if (fields.startDate !== undefined) properties[P.startDate] = buildDate(fields.startDate!);
  if (fields.endDate !== undefined) properties[P.endDate] = buildDate(fields.endDate!);
  if (fields.projectIds !== undefined) properties[P.project] = buildRelation(fields.projectIds);
  if (fields.goal !== undefined) properties[P.goal] = buildRichText(fields.goal);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToCycle(page);
}

export async function archiveCycle(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

/** Fetch every cycle for Supabase sync. */
export async function getAllCycles(): Promise<Cycle[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.cycles,
    sorts: [{ property: P.startDate, direction: "descending" }],
    page_size: 200,
    fetchAll: true,
    label: "getAllCycles",
  });
  return result.pages.map(mapPageToCycle);
}
