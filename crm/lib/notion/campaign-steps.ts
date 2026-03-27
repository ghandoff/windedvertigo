/**
 * Campaign steps data layer.
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
  buildNumber,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, CAMPAIGN_STEP_PROPS } from "./client";
import type {
  CampaignStep,
  CampaignStepFilters,
  PaginationParams,
  SortParams,
} from "./types";
import {
  buildSelectFilter,
  buildRelationContains,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = CAMPAIGN_STEP_PROPS;

function mapPageToStep(page: PageObjectResponse): CampaignStep {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    campaignIds: getRelation(props[P.campaign]),
    stepNumber: getNumber(props[P.stepNumber]),
    channel: getSelect(props[P.channel]) as CampaignStep["channel"],
    subject: getText(props[P.subject]),
    body: getText(props[P.body]),
    delayDays: getNumber(props[P.delayDays]),
    sendDate: getDate(props[P.sendDate]),
    status: getSelect(props[P.status]) as CampaignStep["status"],
    variantBSubject: getText(props[P.variantBSubject]),
    variantBBody: getText(props[P.variantBBody]),
    condition: getText(props[P.condition]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryCampaignSteps(
  filters?: CampaignStepFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.campaignId) nf.push(buildRelationContains(P.campaign, filters.campaignId));
    if (filters.status) nf.push(buildSelectFilter(P.status, filters.status));
    if (filters.channel) nf.push(buildSelectFilter(P.channel, filters.channel));
    if (filters.search) nf.push(buildTitleSearch(P.name, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.campaignSteps,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ property: P.stepNumber, direction: "ascending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryCampaignSteps",
  });

  return {
    data: result.pages.map(mapPageToStep),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

/** Get all steps for a campaign, sorted by step number. */
export async function getStepsForCampaign(campaignId: string): Promise<CampaignStep[]> {
  const result = await queryCampaignSteps({ campaignId }, { pageSize: 100 });
  return result.data;
}

export async function getCampaignStep(id: string): Promise<CampaignStep> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToStep(page);
}

export async function createCampaignStep(
  fields: Partial<CampaignStep> & Pick<CampaignStep, "name">,
): Promise<CampaignStep> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.name]: buildTitle(fields.name),
  };

  if (fields.campaignIds) properties[P.campaign] = buildRelation(fields.campaignIds);
  if (fields.stepNumber != null) properties[P.stepNumber] = buildNumber(fields.stepNumber);
  if (fields.channel) properties[P.channel] = buildSelect(fields.channel);
  if (fields.subject) properties[P.subject] = buildRichText(fields.subject);
  if (fields.body) properties[P.body] = buildRichText(fields.body);
  if (fields.delayDays != null) properties[P.delayDays] = buildNumber(fields.delayDays);
  if (fields.sendDate) properties[P.sendDate] = buildDate(fields.sendDate);
  if (fields.status) properties[P.status] = buildSelect(fields.status);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.campaignSteps },
    properties,
  })) as PageObjectResponse;

  return mapPageToStep(page);
}

export async function updateCampaignStep(
  id: string,
  fields: Partial<CampaignStep>,
): Promise<CampaignStep> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.name !== undefined) properties[P.name] = buildTitle(fields.name);
  if (fields.stepNumber !== undefined) properties[P.stepNumber] = buildNumber(fields.stepNumber);
  if (fields.channel !== undefined) properties[P.channel] = buildSelect(fields.channel);
  if (fields.subject !== undefined) properties[P.subject] = buildRichText(fields.subject);
  if (fields.body !== undefined) properties[P.body] = buildRichText(fields.body);
  if (fields.delayDays !== undefined) properties[P.delayDays] = buildNumber(fields.delayDays);
  if (fields.sendDate !== undefined) properties[P.sendDate] = buildDate(fields.sendDate);
  if (fields.status !== undefined) properties[P.status] = buildSelect(fields.status);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToStep(page);
}

export async function archiveCampaignStep(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}
