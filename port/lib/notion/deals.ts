/**
 * Deals data layer — BD opportunity pipeline.
 */

import {
  getTitle,
  getText,
  getSelect,
  getDate,
  getNumber,
  getRelation,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildDate,
  buildRelation,
  buildNumber,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, DEAL_PROPS } from "./client";
import type { Deal, DealFilters, PaginationParams, SortParams } from "./types";
import {
  buildSelectFilter,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = DEAL_PROPS;

function mapPageToDeal(page: PageObjectResponse): Deal {
  const props = page.properties;
  return {
    id: page.id,
    deal: getTitle(props[P.deal]),
    stage: getSelect(props[P.stage]) as Deal["stage"],
    organizationIds: getRelation(props[P.organization]),
    rfpOpportunityIds: getRelation(props[P.rfpOpportunity]),
    owner: getText(props[P.owner]),
    value: getNumber(props[P.value]),
    closeDate: getDate(props[P.closeDate]),
    lostReason: (getSelect(props[P.lostReason]) as Deal["lostReason"]) ?? null,
    notes: getText(props[P.notes]),
    documents: getText(props[P.documents]) || undefined,
    debriefWhatWorked: getText(props[P.debriefWhatWorked]),
    debriefWhatFellFlat: getText(props[P.debriefWhatFellFlat]),
    debriefWhatWasMissing: getText(props[P.debriefWhatWasMissing]),
    debriefClientFeedback: getText(props[P.debriefClientFeedback]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryDeals(
  filters?: DealFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.stage) nf.push(buildSelectFilter(P.stage, filters.stage));
    if (filters.search) nf.push(buildTitleSearch(P.deal, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.deals,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 100,
    label: "queryDeals",
  });

  return {
    data: result.pages.map(mapPageToDeal),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getDeal(id: string): Promise<Deal> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToDeal(page);
}

export async function createDeal(
  fields: Partial<Deal> & Pick<Deal, "deal">,
): Promise<Deal> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.deal]: buildTitle(fields.deal),
  };

  if (fields.stage) properties[P.stage] = buildSelect(fields.stage);
  if (fields.organizationIds?.length) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.rfpOpportunityIds?.length) properties[P.rfpOpportunity] = buildRelation(fields.rfpOpportunityIds);
  if (fields.owner) properties[P.owner] = buildRichText(fields.owner);
  if (fields.value != null) properties[P.value] = buildNumber(fields.value);
  if (fields.closeDate) properties[P.closeDate] = buildDate(fields.closeDate);
  if (fields.lostReason) properties[P.lostReason] = buildSelect(fields.lostReason);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);
  if (fields.documents !== undefined) properties[P.documents] = buildRichText(fields.documents);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.deals },
    properties,
  })) as PageObjectResponse;

  return mapPageToDeal(page);
}

export async function updateDeal(
  id: string,
  fields: Partial<Deal>,
): Promise<Deal> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.deal !== undefined) properties[P.deal] = buildTitle(fields.deal);
  if (fields.stage !== undefined) properties[P.stage] = buildSelect(fields.stage);
  if (fields.organizationIds !== undefined) properties[P.organization] = buildRelation(fields.organizationIds);
  if (fields.rfpOpportunityIds !== undefined) properties[P.rfpOpportunity] = buildRelation(fields.rfpOpportunityIds);
  if (fields.owner !== undefined) properties[P.owner] = buildRichText(fields.owner);
  if (fields.value !== undefined) properties[P.value] = buildNumber(fields.value ?? 0);
  if (fields.closeDate !== undefined) properties[P.closeDate] = buildDate(fields.closeDate!);
  if (fields.lostReason !== undefined) properties[P.lostReason] = fields.lostReason ? buildSelect(fields.lostReason) : { select: null };
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.documents !== undefined) properties[P.documents] = buildRichText(fields.documents);
  if (fields.debriefWhatWorked !== undefined) properties[P.debriefWhatWorked] = buildRichText(fields.debriefWhatWorked);
  if (fields.debriefWhatFellFlat !== undefined) properties[P.debriefWhatFellFlat] = buildRichText(fields.debriefWhatFellFlat);
  if (fields.debriefWhatWasMissing !== undefined) properties[P.debriefWhatWasMissing] = buildRichText(fields.debriefWhatWasMissing);
  if (fields.debriefClientFeedback !== undefined) properties[P.debriefClientFeedback] = buildRichText(fields.debriefClientFeedback);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToDeal(page);
}

export async function archiveDeal(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

export async function getAllDeals(): Promise<Deal[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.deals,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 200,
    label: "getAllDeals",
  });
  return result.pages.map(mapPageToDeal);
}
