/**
 * Work items (tasks) data layer — the atom of work in the PM module.
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

import { notion, PORT_DB, WORK_ITEM_PROPS } from "./client";
import type { WorkItem, WorkItemFilters, PaginationParams, SortParams } from "./types";
import {
  buildStatusFilter,
  buildSelectFilter,
  buildCheckboxFilter,
  buildRelationContains,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = WORK_ITEM_PROPS;

function mapPageToWorkItem(page: PageObjectResponse): WorkItem {
  const props = page.properties;
  return {
    id: page.id,
    task: getTitle(props[P.task]),
    status: getStatus(props[P.status]) as WorkItem["status"],
    taskType: getSelect(props[P.taskType]) as WorkItem["taskType"],
    priority: getSelect(props[P.priority]) as WorkItem["priority"],
    ownerIds: getPerson(props[P.owner]),
    personIds: getPerson(props[P.person]),
    projectIds: getRelation(props[P.project]),
    milestoneIds: getRelation(props[P.milestone]),
    parentTaskIds: getRelation(props[P.parentTask]),
    subTaskIds: getRelation(props[P.subTasks]),
    blockingIds: getRelation(props[P.blocking]),
    blockedByIds: getRelation(props[P.blockedBy]),
    timesheetIds: getRelation(props[P.timesheets]),
    meetingIds: getRelation(props[P.meeting]),
    dueDate: getDate(props[P.dueDate]),
    estimateHours: getNumber(props[P.estimateHours]),
    archive: getCheckbox(props[P.archive]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryWorkItems(
  filters?: WorkItemFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildStatusFilter(P.status, filters.status));
    if (filters.taskType) nf.push(buildSelectFilter(P.taskType, filters.taskType));
    if (filters.priority) nf.push(buildSelectFilter(P.priority, filters.priority));
    if (filters.projectId) nf.push(buildRelationContains(P.project, filters.projectId));
    if (filters.milestoneId) nf.push(buildRelationContains(P.milestone, filters.milestoneId));
    if (filters.archive !== undefined) nf.push(buildCheckboxFilter(P.archive, filters.archive));
    if (filters.search) nf.push(buildTitleSearch(P.task, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.workItems,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 100,
    fetchAll: pagination?.fetchAll ?? false,
    label: "queryWorkItems",
  });

  return {
    data: result.pages.map(mapPageToWorkItem),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getWorkItem(id: string): Promise<WorkItem> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToWorkItem(page);
}

export async function createWorkItem(
  fields: Partial<WorkItem> & Pick<WorkItem, "task">,
): Promise<WorkItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.task]: buildTitle(fields.task),
  };

  if (fields.status) properties[P.status] = buildStatus(fields.status);
  if (fields.taskType) properties[P.taskType] = buildSelect(fields.taskType);
  if (fields.priority) properties[P.priority] = buildSelect(fields.priority);
  if (fields.ownerIds?.length) properties[P.owner] = buildPerson(fields.ownerIds);
  if (fields.personIds?.length) properties[P.person] = buildPerson(fields.personIds);
  if (fields.projectIds?.length) properties[P.project] = buildRelation(fields.projectIds);
  if (fields.milestoneIds?.length) properties[P.milestone] = buildRelation(fields.milestoneIds);
  if (fields.parentTaskIds?.length) properties[P.parentTask] = buildRelation(fields.parentTaskIds);
  if (fields.dueDate) properties[P.dueDate] = buildDate(fields.dueDate);
  if (fields.estimateHours != null) properties[P.estimateHours] = buildNumber(fields.estimateHours);
  if (fields.archive !== undefined) properties[P.archive] = buildCheckbox(fields.archive);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.workItems },
    properties,
  })) as PageObjectResponse;

  return mapPageToWorkItem(page);
}

export async function updateWorkItem(
  id: string,
  fields: Partial<WorkItem>,
): Promise<WorkItem> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.task !== undefined) properties[P.task] = buildTitle(fields.task);
  if (fields.status !== undefined) properties[P.status] = buildStatus(fields.status);
  if (fields.taskType !== undefined) properties[P.taskType] = buildSelect(fields.taskType);
  if (fields.priority !== undefined) properties[P.priority] = buildSelect(fields.priority);
  if (fields.ownerIds !== undefined) properties[P.owner] = buildPerson(fields.ownerIds);
  if (fields.personIds !== undefined) properties[P.person] = buildPerson(fields.personIds);
  if (fields.projectIds !== undefined) properties[P.project] = buildRelation(fields.projectIds);
  if (fields.milestoneIds !== undefined) properties[P.milestone] = buildRelation(fields.milestoneIds);
  if (fields.parentTaskIds !== undefined) properties[P.parentTask] = buildRelation(fields.parentTaskIds);
  if (fields.dueDate !== undefined) properties[P.dueDate] = buildDate(fields.dueDate!);
  if (fields.estimateHours !== undefined) properties[P.estimateHours] = buildNumber(fields.estimateHours ?? 0);
  if (fields.archive !== undefined) properties[P.archive] = buildCheckbox(fields.archive);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToWorkItem(page);
}

export async function archiveWorkItem(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

export async function getAllWorkItems(): Promise<WorkItem[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.workItems,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 200,
    label: "getAllWorkItems",
  });
  return result.pages.map(mapPageToWorkItem);
}
