/**
 * Phases & milestones data layer.
 *
 * A row is either a `phase` (duration-bearing, contains work items, billing-aligned)
 * or a `milestone` (zero-duration checkpoint — approval, delivery, launch).
 * Archived rows are excluded by default; pass `includeArchived: true` to opt in.
 */

import {
  getTitle,
  getSelect,
  getStatus,
  getDate,
  getCheckbox,
  getNumber,
  getRelation,
  getPerson,
  getText,
  queryDatabase,
  buildTitle,
  buildSelect,
  buildStatus,
  buildDate,
  buildCheckbox,
  buildNumber,
  buildRelation,
  buildPerson,
  buildRichText,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, MILESTONE_PROPS } from "./client";
import type { Milestone, MilestoneFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildStatusFilter,
  buildCheckboxFilter,
  buildRelationContains,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = MILESTONE_PROPS;

// Notion's status options are "not started" | "in progress" | "done" | "n/a";
// the app's MilestoneStatus enum uses "complete" (not "done") and has no n/a.
// Normalize here so downstream code keeps one vocabulary.
function normalizeStatus(raw: string): Milestone["milestoneStatus"] {
  if (raw === "done") return "complete";
  if (raw === "n/a" || raw === "" || !raw) return "not started";
  return raw as Milestone["milestoneStatus"];
}

function mapPageToMilestone(page: PageObjectResponse): Milestone {
  const props = page.properties;
  const start = getDate(props[P.startDate]);
  const end = getDate(props[P.endDate]);
  return {
    id: page.id,
    milestone: getTitle(props[P.milestone]),
    kind: (getSelect(props[P.kind]) ?? "milestone") as Milestone["kind"],
    milestoneStatus: normalizeStatus(getStatus(props[P.milestoneStatus])),
    projectIds: getRelation(props[P.project]),
    taskIds: getRelation(props[P.tasks]),
    startDate: start?.start ?? null,
    endDate: end?.start ?? null,
    ownerIds: getPerson(props[P.owner]),
    clientVisible: getCheckbox(props[P.clientVisible]),
    description: getText(props[P.description]),
    brief: getText(props[P.brief]),
    billingTotal: getNumber(props[P.billingTotal]),
    archive: getCheckbox(props[P.archive]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryMilestones(
  filters?: MilestoneFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (!filters?.includeArchived) nf.push(buildCheckboxFilter(P.archive, false));
  if (filters?.kind) nf.push(buildSelectFilter(P.kind, filters.kind));
  if (filters?.milestoneStatus) nf.push(buildStatusFilter(P.milestoneStatus, filters.milestoneStatus));
  if (filters?.projectId) nf.push(buildRelationContains(P.project, filters.projectId));
  if (filters?.clientVisible !== undefined) nf.push(buildCheckboxFilter(P.clientVisible, filters.clientVisible));
  if (filters?.search) nf.push(buildTitleSearch(P.milestone, filters.search));

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.milestones,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    fetchAll: pagination?.fetchAll ?? false,
    label: "queryMilestones",
  });

  return {
    data: result.pages.map(mapPageToMilestone),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getMilestone(id: string): Promise<Milestone> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToMilestone(page);
}

export async function createMilestone(
  fields: Partial<Milestone> & Pick<Milestone, "milestone" | "kind">,
): Promise<Milestone> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.milestone]: buildTitle(fields.milestone),
    [P.kind]: buildSelect(fields.kind),
  };

  if (fields.milestoneStatus) properties[P.milestoneStatus] = buildStatus(fields.milestoneStatus);
  if (fields.projectIds?.length) properties[P.project] = buildRelation(fields.projectIds);
  if (fields.startDate) properties[P.startDate] = buildDate({ start: fields.startDate, end: null });
  if (fields.endDate) properties[P.endDate] = buildDate({ start: fields.endDate, end: null });
  if (fields.ownerIds?.length) properties[P.owner] = buildPerson(fields.ownerIds);
  if (fields.clientVisible !== undefined) properties[P.clientVisible] = buildCheckbox(fields.clientVisible);
  if (fields.description) properties[P.description] = buildRichText(fields.description);
  if (fields.brief) properties[P.brief] = buildRichText(fields.brief);
  if (fields.billingTotal !== undefined && fields.billingTotal !== null) {
    properties[P.billingTotal] = buildNumber(fields.billingTotal);
  }

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.milestones },
    properties,
  })) as PageObjectResponse;

  return mapPageToMilestone(page);
}

export async function updateMilestone(
  id: string,
  fields: Partial<Milestone>,
): Promise<Milestone> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.milestone !== undefined) properties[P.milestone] = buildTitle(fields.milestone);
  if (fields.kind !== undefined) properties[P.kind] = buildSelect(fields.kind);
  if (fields.milestoneStatus !== undefined) properties[P.milestoneStatus] = buildStatus(fields.milestoneStatus);
  if (fields.projectIds !== undefined) properties[P.project] = buildRelation(fields.projectIds);
  if (fields.startDate !== undefined) {
    properties[P.startDate] = fields.startDate
      ? buildDate({ start: fields.startDate, end: null })
      : null;
  }
  if (fields.endDate !== undefined) {
    properties[P.endDate] = fields.endDate
      ? buildDate({ start: fields.endDate, end: null })
      : null;
  }
  if (fields.ownerIds !== undefined) properties[P.owner] = buildPerson(fields.ownerIds);
  if (fields.clientVisible !== undefined) properties[P.clientVisible] = buildCheckbox(fields.clientVisible);
  if (fields.description !== undefined) properties[P.description] = buildRichText(fields.description);
  if (fields.brief !== undefined) properties[P.brief] = buildRichText(fields.brief);
  if (fields.billingTotal !== undefined) {
    properties[P.billingTotal] = fields.billingTotal === null ? null : buildNumber(fields.billingTotal);
  }
  if (fields.archive !== undefined) properties[P.archive] = buildCheckbox(fields.archive);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToMilestone(page);
}

export async function archiveMilestone(id: string): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: { [P.archive]: buildCheckbox(true) },
  });
}

/** Fetch every milestone (including archived) for Supabase sync. */
export async function getAllMilestones(): Promise<Milestone[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.milestones,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 200,
    fetchAll: true,
    label: "getAllMilestones",
  });
  return result.pages.map(mapPageToMilestone);
}
