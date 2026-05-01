/**
 * Projects data layer.
 */

import {
  getTitle,
  getSelect,
  getStatus,
  getDate,
  getNumber,
  getCheckbox,
  getRelation,
  getPerson,
  queryDatabase,
  buildTitle,
  buildSelect,
  buildStatus,
  buildDate,
  buildNumber,
  buildCheckbox,
  buildRelation,
  buildPerson,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, PROJECT_PROPS } from "./client";
import type { Project, ProjectFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildStatusFilter,
  buildCheckboxFilter,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = PROJECT_PROPS;

function mapPageToProject(page: PageObjectResponse): Project {
  const props = page.properties;
  return {
    id: page.id,
    project: getTitle(props[P.project]),
    status: getStatus(props[P.status]) as Project["status"],
    priority: getSelect(props[P.priority]) as Project["priority"],
    type: (getSelect(props[P.type]) as Project["type"]) || null,
    budgetHours: getNumber(props[P.budgetHours]),
    eventType: getSelect(props[P.eventType]),
    timeline: getDate(props[P.timeline]),
    dateAndTime: getDate(props[P.dateAndTime]),
    projectLeadIds: getPerson(props[P.projectLeads]),
    organizationIds: getRelation(props[P.group]),
    milestoneIds: getRelation(props[P.milestones]),
    taskIds: getRelation(props[P.tasks]),
    cycleIds: getRelation(props[P.cycles]),
    archive: getCheckbox(props[P.archive]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryProjects(
  filters?: ProjectFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildStatusFilter(P.status, filters.status));
    if (filters.priority) nf.push(buildSelectFilter(P.priority, filters.priority));
    if (filters.type) nf.push(buildSelectFilter(P.type, filters.type));
    if (filters.archive !== undefined) nf.push(buildCheckboxFilter(P.archive, filters.archive));
    if (filters.search) nf.push(buildTitleSearch(P.project, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.projects,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryProjects",
  });

  return {
    data: result.pages.map(mapPageToProject),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getProject(id: string): Promise<Project> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToProject(page);
}

export async function createProject(
  fields: Partial<Project> & Pick<Project, "project">,
): Promise<Project> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.project]: buildTitle(fields.project),
  };

  if (fields.status) properties[P.status] = buildStatus(fields.status);
  if (fields.priority) properties[P.priority] = buildSelect(fields.priority);
  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.budgetHours != null) properties[P.budgetHours] = buildNumber(fields.budgetHours);
  if (fields.eventType) properties[P.eventType] = buildSelect(fields.eventType);
  if (fields.timeline) properties[P.timeline] = buildDate(fields.timeline);
  if (fields.dateAndTime) properties[P.dateAndTime] = buildDate(fields.dateAndTime);
  if (fields.projectLeadIds) properties[P.projectLeads] = buildPerson(fields.projectLeadIds);
  if (fields.organizationIds) properties[P.group] = buildRelation(fields.organizationIds);
  if (fields.archive !== undefined) properties[P.archive] = buildCheckbox(fields.archive);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.projects },
    properties,
  })) as PageObjectResponse;

  return mapPageToProject(page);
}

export async function updateProject(
  id: string,
  fields: Partial<Project>,
): Promise<Project> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.project !== undefined) properties[P.project] = buildTitle(fields.project);
  if (fields.status !== undefined) properties[P.status] = buildStatus(fields.status);
  if (fields.priority !== undefined) properties[P.priority] = buildSelect(fields.priority);
  if (fields.type !== undefined) properties[P.type] = fields.type ? buildSelect(fields.type) : { select: null };
  if (fields.budgetHours !== undefined) properties[P.budgetHours] = buildNumber(fields.budgetHours ?? 0);
  if (fields.eventType !== undefined) properties[P.eventType] = buildSelect(fields.eventType);
  if (fields.timeline !== undefined) properties[P.timeline] = buildDate(fields.timeline);
  if (fields.dateAndTime !== undefined) properties[P.dateAndTime] = buildDate(fields.dateAndTime);
  if (fields.projectLeadIds !== undefined) properties[P.projectLeads] = buildPerson(fields.projectLeadIds);
  if (fields.organizationIds !== undefined) properties[P.group] = buildRelation(fields.organizationIds);
  if (fields.archive !== undefined) properties[P.archive] = buildCheckbox(fields.archive);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToProject(page);
}

export async function archiveProject(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

/** Fetch every project (including archived) for Supabase sync. */
export async function getAllProjects(): Promise<Project[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.projects,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 200,
    fetchAll: true,
    label: "getAllProjects",
  });
  return result.pages.map(mapPageToProject);
}
