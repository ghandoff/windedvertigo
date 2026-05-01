/**
 * Timesheets data layer — time entries with approval workflow.
 *
 * Existing DB with status flow: draft → submitted → approved → invoiced → paid.
 * Used by both contract mode (billable tracking) and the GCal auto-sync cron.
 */

import {
  getTitle,
  getStatus,
  getSelect,
  getDate,
  getNumber,
  getCheckbox,
  getRelation,
  getPerson,
  getText,
  queryDatabase,
  buildTitle,
  buildStatus,
  buildSelect,
  buildDate,
  buildNumber,
  buildCheckbox,
  buildRelation,
  buildPerson,
  buildRichText,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, TIMESHEET_PROPS } from "./client";
import type { Timesheet, TimesheetFilters, PaginationParams, SortParams } from "./types";
import {
  buildStatusFilter,
  buildSelectFilter,
  buildCheckboxFilter,
  buildRelationContains,
  buildPeopleContains,
  buildDateAfter,
  buildDateBefore,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = TIMESHEET_PROPS;

function mapPageToTimesheet(page: PageObjectResponse): Timesheet {
  const props = page.properties;
  const rawType = getSelect(props[P.type]);
  return {
    id: page.id,
    entry: getTitle(props[P.entry]),
    personIds: getPerson(props[P.person]),
    dateAndTime: getDate(props[P.dateAndTime]),
    hours: getNumber(props[P.hours]),
    minutes: getNumber(props[P.minutes]),
    status: getStatus(props[P.status]) as Timesheet["status"],
    type: (rawType === "reimbursement" ? "reimbursement" : "time") as Timesheet["type"],
    taskIds: getRelation(props[P.task]),
    meetingIds: getRelation(props[P.meeting]),
    billable: getCheckbox(props[P.billable]),
    rate: getNumber(props[P.rate]),
    amount: getNumber(props[P.amount]),
    explanation: getText(props[P.explanation]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryTimesheets(
  filters?: TimesheetFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildStatusFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildStatusFilter(P.status, filters.status));
    if (filters.type) nf.push(buildSelectFilter(P.type, filters.type));
    if (filters.billable !== undefined) nf.push(buildCheckboxFilter(P.billable, filters.billable));
    if (filters.taskId) nf.push(buildRelationContains(P.task, filters.taskId));
    if (filters.dateAfter) nf.push(buildDateAfter(P.dateAndTime, filters.dateAfter));
    if (filters.dateBefore) nf.push(buildDateBefore(P.dateAndTime, filters.dateBefore));
    if (filters.search) nf.push(buildTitleSearch(P.entry, filters.search));
    if (filters.personId) nf.push(buildPeopleContains(P.person, filters.personId));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.timesheets,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.dateAndTime, direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 100,
    fetchAll: pagination?.fetchAll ?? false,
    label: "queryTimesheets",
  });

  return {
    data: result.pages.map(mapPageToTimesheet),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getTimesheet(id: string): Promise<Timesheet> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToTimesheet(page);
}

export async function createTimesheet(
  fields: Partial<Timesheet> & Pick<Timesheet, "entry">,
): Promise<Timesheet> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.entry]: buildTitle(fields.entry),
  };

  if (fields.status) properties[P.status] = buildStatus(fields.status);
  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.personIds?.length) properties[P.person] = buildPerson(fields.personIds);
  if (fields.dateAndTime) properties[P.dateAndTime] = buildDate(fields.dateAndTime);
  if (fields.hours != null) properties[P.hours] = buildNumber(fields.hours);
  if (fields.minutes != null) properties[P.minutes] = buildNumber(fields.minutes);
  if (fields.taskIds?.length) properties[P.task] = buildRelation(fields.taskIds);
  if (fields.meetingIds?.length) properties[P.meeting] = buildRelation(fields.meetingIds);
  if (fields.billable !== undefined) properties[P.billable] = buildCheckbox(fields.billable);
  if (fields.rate != null) properties[P.rate] = buildNumber(fields.rate);
  if (fields.amount != null) properties[P.amount] = buildNumber(fields.amount);
  if (fields.explanation) properties[P.explanation] = buildRichText(fields.explanation);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.timesheets },
    properties,
  })) as PageObjectResponse;

  return mapPageToTimesheet(page);
}

export async function updateTimesheet(
  id: string,
  fields: Partial<Timesheet>,
): Promise<Timesheet> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.entry !== undefined) properties[P.entry] = buildTitle(fields.entry);
  if (fields.status !== undefined) properties[P.status] = buildStatus(fields.status);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.personIds !== undefined) properties[P.person] = buildPerson(fields.personIds);
  if (fields.dateAndTime !== undefined) properties[P.dateAndTime] = buildDate(fields.dateAndTime!);
  if (fields.hours !== undefined) properties[P.hours] = buildNumber(fields.hours ?? 0);
  if (fields.minutes !== undefined) properties[P.minutes] = buildNumber(fields.minutes ?? 0);
  if (fields.taskIds !== undefined) properties[P.task] = buildRelation(fields.taskIds);
  if (fields.meetingIds !== undefined) properties[P.meeting] = buildRelation(fields.meetingIds);
  if (fields.billable !== undefined) properties[P.billable] = buildCheckbox(fields.billable);
  if (fields.rate !== undefined) properties[P.rate] = buildNumber(fields.rate ?? 0);
  if (fields.amount !== undefined) properties[P.amount] = buildNumber(fields.amount ?? 0);
  if (fields.explanation !== undefined) properties[P.explanation] = buildRichText(fields.explanation);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToTimesheet(page);
}

export async function archiveTimesheet(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

export async function getAllTimesheets(): Promise<Timesheet[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.timesheets,
    sorts: [{ property: P.dateAndTime, direction: "descending" }],
    page_size: 200,
    label: "getAllTimesheets",
  });
  return result.pages.map(mapPageToTimesheet);
}
