/**
 * RFP Radar data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getStatus,
  getDate,
  getUrl,
  getNumber,
  getRelation,
  getPerson,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildMultiSelect,
  buildStatus,
  buildDate,
  buildUrl,
  buildNumber,
  buildRelation,
  buildPerson,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, RFP_PROPS } from "./client";
import type {
  RfpOpportunity,
  RfpFilters,
  RfpStatus,
  PaginationParams,
  SortParams,
} from "./types";
import {
  buildSelectFilter,
  buildStatusFilter,
  buildTitleSearch,
  buildCompoundFilter,
  buildDateAfter,
} from "./filters";

const P = RFP_PROPS;

function mapPageToRfp(page: PageObjectResponse): RfpOpportunity {
  const props = page.properties;
  return {
    id: page.id,
    opportunityName: getTitle(props[P.opportunityName]),
    status: getStatus(props[P.status]) as RfpOpportunity["status"],
    opportunityType: getSelect(props[P.opportunityType]) as RfpOpportunity["opportunityType"],
    organizationIds: getRelation(props[P.organization]),
    relatedProjectIds: getRelation(props[P.relatedProject]),
    ownerIds: getPerson(props[P.owner]),
    dueDate: getDate(props[P.dueDate]),
    estimatedValue: getNumber(props[P.estimatedValue]),
    wvFitScore: getSelect(props[P.wvFitScore]) as RfpOpportunity["wvFitScore"],
    serviceMatch: getMultiSelect(props[P.serviceMatch]) as RfpOpportunity["serviceMatch"],
    category: getMultiSelect(props[P.category]),
    geography: getMultiSelect(props[P.geography]),
    source: getSelect(props[P.source]) as RfpOpportunity["source"],
    requirementsSnapshot: getText(props[P.requirementsSnapshot]),
    decisionNotes: getText(props[P.decisionNotes]),
    url: getUrl(props[P.url]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryRfpOpportunities(
  filters?: RfpFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildStatusFilter(P.status, filters.status));
    if (filters.opportunityType) nf.push(buildSelectFilter(P.opportunityType, filters.opportunityType));
    if (filters.wvFitScore) nf.push(buildSelectFilter(P.wvFitScore, filters.wvFitScore));
    if (filters.source) nf.push(buildSelectFilter(P.source, filters.source));
    if (filters.search) nf.push(buildTitleSearch(P.opportunityName, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.rfpRadar,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.dueDate, direction: "ascending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryRfpOpportunities",
  });

  return {
    data: result.pages.map(mapPageToRfp),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getRfpOpportunity(id: string): Promise<RfpOpportunity> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToRfp(page);
}

export async function createRfpOpportunity(
  fields: Partial<RfpOpportunity> & Pick<RfpOpportunity, "opportunityName">,
): Promise<RfpOpportunity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.opportunityName]: buildTitle(fields.opportunityName),
  };

  if (fields.status) properties[P.status] = buildStatus(fields.status);
  if (fields.opportunityType) properties[P.opportunityType] = buildSelect(fields.opportunityType);
  if (fields.organizationIds) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.relatedProjectIds) properties[P.relatedProject] = buildRelation(fields.relatedProjectIds);
  if (fields.ownerIds) properties[P.owner] = buildPerson(fields.ownerIds);
  if (fields.dueDate) properties[P.dueDate] = buildDate(fields.dueDate);
  if (fields.estimatedValue) properties[P.estimatedValue] = buildNumber(fields.estimatedValue);
  if (fields.wvFitScore) properties[P.wvFitScore] = buildSelect(fields.wvFitScore);
  if (fields.serviceMatch) properties[P.serviceMatch] = buildMultiSelect(fields.serviceMatch);
  if (fields.category) properties[P.category] = buildMultiSelect(fields.category);
  if (fields.geography) properties[P.geography] = buildMultiSelect(fields.geography);
  if (fields.source) properties[P.source] = buildSelect(fields.source);
  if (fields.requirementsSnapshot) properties[P.requirementsSnapshot] = buildRichText(fields.requirementsSnapshot);
  if (fields.decisionNotes) properties[P.decisionNotes] = buildRichText(fields.decisionNotes);
  if (fields.url) properties[P.url] = buildUrl(fields.url);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.rfpRadar },
    properties,
  })) as PageObjectResponse;

  return mapPageToRfp(page);
}

export async function updateRfpOpportunity(
  id: string,
  fields: Partial<RfpOpportunity>,
): Promise<RfpOpportunity> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.opportunityName !== undefined) properties[P.opportunityName] = buildTitle(fields.opportunityName);
  if (fields.status !== undefined) properties[P.status] = buildStatus(fields.status);
  if (fields.opportunityType !== undefined) properties[P.opportunityType] = buildSelect(fields.opportunityType);
  if (fields.organizationIds !== undefined) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.relatedProjectIds !== undefined) properties[P.relatedProject] = buildRelation(fields.relatedProjectIds);
  if (fields.ownerIds !== undefined) properties[P.owner] = buildPerson(fields.ownerIds);
  if (fields.dueDate !== undefined) properties[P.dueDate] = buildDate(fields.dueDate);
  if (fields.estimatedValue !== undefined) properties[P.estimatedValue] = buildNumber(fields.estimatedValue);
  if (fields.wvFitScore !== undefined) properties[P.wvFitScore] = buildSelect(fields.wvFitScore);
  if (fields.serviceMatch !== undefined) properties[P.serviceMatch] = buildMultiSelect(fields.serviceMatch);
  if (fields.category !== undefined) properties[P.category] = buildMultiSelect(fields.category);
  if (fields.geography !== undefined) properties[P.geography] = buildMultiSelect(fields.geography);
  if (fields.source !== undefined) properties[P.source] = buildSelect(fields.source);
  if (fields.requirementsSnapshot !== undefined) properties[P.requirementsSnapshot] = buildRichText(fields.requirementsSnapshot);
  if (fields.decisionNotes !== undefined) properties[P.decisionNotes] = buildRichText(fields.decisionNotes);
  if (fields.url !== undefined) properties[P.url] = buildUrl(fields.url);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToRfp(page);
}

export async function archiveRfpOpportunity(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

/** Convenience: advance the RFP status. */
export async function updateRfpStatus(
  id: string,
  status: RfpStatus,
): Promise<RfpOpportunity> {
  return updateRfpOpportunity(id, { status });
}
