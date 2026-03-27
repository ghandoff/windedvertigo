/**
 * Organizations data layer — query, get, create, update, archive.
 *
 * Unified database merging groups + market map.
 * Primary pipeline: connection status (unengaged → champion/steward).
 */

import {
  getTitle,
  getText,
  getSelect,
  getMultiSelect,
  getStatus,
  getUrl,
  getEmail,
  getRelation,
  getPlace,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildMultiSelect,
  buildStatus,
  buildUrl,
  buildEmail,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, ORG_PROPS } from "./client";
import type {
  Organization,
  OrganizationFilters,
  PaginationParams,
  SortParams,
  ConnectionStatus,
  OutreachStatus,
} from "./types";
import {
  buildSelectFilter,
  buildStatusFilter,
  buildMultiSelectContains,
  buildTitleSearch,
  buildSelectOrGroup,
  buildCompoundFilter,
} from "./filters";

const P = ORG_PROPS;

// ── mapper ────────────────────────────────────────────────

function mapPageToOrganization(page: PageObjectResponse): Organization {
  const props = page.properties;
  return {
    id: page.id,
    organization: getTitle(props[P.organization]),
    connection: getStatus(props[P.connection]) as Organization["connection"],
    type: getSelect(props[P.type]) as Organization["type"],
    category: getMultiSelect(props[P.category]) as Organization["category"],
    regions: getMultiSelect(props[P.regions]) as Organization["regions"],
    source: getSelect(props[P.source]) as Organization["source"],
    website: getUrl(props[P.website]),
    place: getPlace(props[P.place]),
    email: getEmail(props[P.email]),
    outreachTarget: getText(props[P.outreachTarget]),
    priority: getSelect(props[P.priority]) as Organization["priority"],
    fitRating: getSelect(props[P.fitRating]) as Organization["fitRating"],
    friendship: getSelect(props[P.friendship]) as Organization["friendship"],
    howTheyBuy: getSelect(props[P.howTheyBuy]) as Organization["howTheyBuy"],
    marketSegment: getSelect(props[P.marketSegment]),
    quadrant: getSelect(props[P.quadrant]) as Organization["quadrant"],
    crossQuadrant: getMultiSelect(props[P.crossQuadrant]) as Organization["crossQuadrant"],
    serviceLine: getMultiSelect(props[P.serviceLine]),
    targetServices: getText(props[P.targetServices]),
    buyingTrigger: getText(props[P.buyingTrigger]),
    buyerRole: getText(props[P.buyerRole]),
    subject: getText(props[P.subject]),
    bespokeEmailCopy: getText(props[P.bespokeEmailCopy]),
    outreachSuggestion: getText(props[P.outreachSuggestion]),
    outreachStatus: getSelect(props[P.outreachStatus]) as Organization["outreachStatus"],
    notes: getText(props[P.notes]),
    contactIds: getRelation(props[P.contacts]),
    projectIds: getRelation(props[P.projects]),
    bdAssetIds: getRelation(props[P.bdAssets]),
    competitorIds: getRelation(props[P.competitors]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// ── query ─────────────────────────────────────────────────

export async function queryOrganizations(
  filters?: OrganizationFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const notionFilters: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.connection) notionFilters.push(buildSelectOrGroup(P.connection, filters.connection, buildStatusFilter));
    if (filters.outreachStatus) notionFilters.push(buildSelectOrGroup(P.outreachStatus, filters.outreachStatus));
    if (filters.type) notionFilters.push(buildSelectOrGroup(P.type, filters.type));
    if (filters.category) notionFilters.push(buildSelectOrGroup(P.category, filters.category, buildMultiSelectContains));
    if (filters.region) notionFilters.push(buildSelectOrGroup(P.regions, filters.region, buildMultiSelectContains));
    if (filters.source) notionFilters.push(buildSelectOrGroup(P.source, filters.source));
    if (filters.priority) notionFilters.push(buildSelectOrGroup(P.priority, filters.priority));
    if (filters.fitRating) notionFilters.push(buildSelectOrGroup(P.fitRating, filters.fitRating));
    if (filters.friendship) notionFilters.push(buildSelectOrGroup(P.friendship, filters.friendship));
    if (filters.marketSegment) notionFilters.push(buildSelectOrGroup(P.marketSegment, filters.marketSegment));
    if (filters.quadrant) notionFilters.push(buildSelectOrGroup(P.quadrant, filters.quadrant));
    if (filters.search) notionFilters.push(buildTitleSearch(P.organization, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.organizations,
    filter: buildCompoundFilter(notionFilters),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryOrganizations",
  });

  return {
    data: result.pages.map(mapPageToOrganization),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

// ── get ───────────────────────────────────────────────────

export async function getOrganization(id: string): Promise<Organization> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToOrganization(page);
}

// ── create ────────────────────────────────────────────────

export async function createOrganization(
  fields: Partial<Organization> & Pick<Organization, "organization">,
): Promise<Organization> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.organization]: buildTitle(fields.organization),
  };

  if (fields.connection) properties[P.connection] = buildStatus(fields.connection);
  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.category) properties[P.category] = buildMultiSelect(fields.category);
  if (fields.regions) properties[P.regions] = buildMultiSelect(fields.regions);
  if (fields.source) properties[P.source] = buildSelect(fields.source);
  if (fields.website) properties[P.website] = buildUrl(fields.website);
  if (fields.email) properties[P.email] = buildEmail(fields.email);
  if (fields.outreachTarget) properties[P.outreachTarget] = buildRichText(fields.outreachTarget);
  if (fields.priority) properties[P.priority] = buildSelect(fields.priority);
  if (fields.fitRating) properties[P.fitRating] = buildSelect(fields.fitRating);
  if (fields.friendship) properties[P.friendship] = buildSelect(fields.friendship);
  if (fields.howTheyBuy) properties[P.howTheyBuy] = buildSelect(fields.howTheyBuy);
  if (fields.marketSegment) properties[P.marketSegment] = buildSelect(fields.marketSegment);
  if (fields.quadrant) properties[P.quadrant] = buildSelect(fields.quadrant);
  if (fields.crossQuadrant) properties[P.crossQuadrant] = buildMultiSelect(fields.crossQuadrant);
  if (fields.serviceLine) properties[P.serviceLine] = buildMultiSelect(fields.serviceLine);
  if (fields.targetServices) properties[P.targetServices] = buildRichText(fields.targetServices);
  if (fields.buyingTrigger) properties[P.buyingTrigger] = buildRichText(fields.buyingTrigger);
  if (fields.buyerRole) properties[P.buyerRole] = buildRichText(fields.buyerRole);
  if (fields.subject) properties[P.subject] = buildRichText(fields.subject);
  if (fields.bespokeEmailCopy) properties[P.bespokeEmailCopy] = buildRichText(fields.bespokeEmailCopy);
  if (fields.outreachSuggestion) properties[P.outreachSuggestion] = buildRichText(fields.outreachSuggestion);
  if (fields.outreachStatus) properties[P.outreachStatus] = buildSelect(fields.outreachStatus);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);
  if (fields.contactIds) properties[P.contacts] = buildRelation(fields.contactIds);
  if (fields.competitorIds) properties[P.competitors] = buildRelation(fields.competitorIds);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.organizations },
    properties,
  })) as PageObjectResponse;

  return mapPageToOrganization(page);
}

// ── update ────────────────────────────────────────────────

export async function updateOrganization(
  id: string,
  fields: Partial<Organization>,
): Promise<Organization> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.organization !== undefined) properties[P.organization] = buildTitle(fields.organization);
  if (fields.connection !== undefined) properties[P.connection] = buildStatus(fields.connection);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.category !== undefined) properties[P.category] = buildMultiSelect(fields.category);
  if (fields.regions !== undefined) properties[P.regions] = buildMultiSelect(fields.regions);
  if (fields.source !== undefined) properties[P.source] = buildSelect(fields.source);
  if (fields.website !== undefined) properties[P.website] = buildUrl(fields.website);
  if (fields.email !== undefined) properties[P.email] = buildEmail(fields.email);
  if (fields.outreachTarget !== undefined) properties[P.outreachTarget] = buildRichText(fields.outreachTarget);
  if (fields.priority !== undefined) properties[P.priority] = buildSelect(fields.priority);
  if (fields.fitRating !== undefined) properties[P.fitRating] = buildSelect(fields.fitRating);
  if (fields.friendship !== undefined) properties[P.friendship] = buildSelect(fields.friendship);
  if (fields.howTheyBuy !== undefined) properties[P.howTheyBuy] = buildSelect(fields.howTheyBuy);
  if (fields.marketSegment !== undefined) properties[P.marketSegment] = buildSelect(fields.marketSegment);
  if (fields.quadrant !== undefined) properties[P.quadrant] = buildSelect(fields.quadrant);
  if (fields.crossQuadrant !== undefined) properties[P.crossQuadrant] = buildMultiSelect(fields.crossQuadrant);
  if (fields.serviceLine !== undefined) properties[P.serviceLine] = buildMultiSelect(fields.serviceLine);
  if (fields.targetServices !== undefined) properties[P.targetServices] = buildRichText(fields.targetServices);
  if (fields.buyingTrigger !== undefined) properties[P.buyingTrigger] = buildRichText(fields.buyingTrigger);
  if (fields.buyerRole !== undefined) properties[P.buyerRole] = buildRichText(fields.buyerRole);
  if (fields.subject !== undefined) properties[P.subject] = buildRichText(fields.subject);
  if (fields.bespokeEmailCopy !== undefined) properties[P.bespokeEmailCopy] = buildRichText(fields.bespokeEmailCopy);
  if (fields.outreachSuggestion !== undefined) properties[P.outreachSuggestion] = buildRichText(fields.outreachSuggestion);
  if (fields.outreachStatus !== undefined) properties[P.outreachStatus] = buildSelect(fields.outreachStatus);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.contactIds !== undefined) properties[P.contacts] = buildRelation(fields.contactIds);
  if (fields.competitorIds !== undefined) properties[P.competitors] = buildRelation(fields.competitorIds);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToOrganization(page);
}

/** Convenience: advance the primary pipeline status. */
export function updateConnection(id: string, status: ConnectionStatus) {
  return updateOrganization(id, { connection: status });
}

/** Convenience: advance the outreach campaign status. */
export function updateOutreachStatus(id: string, status: OutreachStatus) {
  return updateOrganization(id, { outreachStatus: status });
}

// ── archive ───────────────────────────────────────────────

export async function archiveOrganization(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}
