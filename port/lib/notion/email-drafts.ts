/**
 * Email drafts data layer — tracks sent emails with open/click metrics.
 */

import {
  getTitle,
  getText,
  getSelect,
  getDate,
  getNumber,
  getRelation,
  getEmail,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildDate,
  buildNumber,
  buildRelation,
  buildEmail,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, EMAIL_DRAFT_PROPS } from "./client";
import type { EmailDraft, EmailDraftStatus, PaginationParams, SortParams } from "./types";
import { buildSelectFilter, buildTextSearch, buildTextEquals, buildTitleSearch, buildRelationContains, buildCompoundFilter } from "./filters";

const P = EMAIL_DRAFT_PROPS;

function mapPageToEmailDraft(page: PageObjectResponse): EmailDraft {
  const props = page.properties;
  const orgIds = getRelation(props[P.organization]);
  const contactIds = getRelation(props[P.contact]);
  const campaignIds = getRelation(props[P.campaignId]);
  const stepIds = getRelation(props[P.stepId]);
  return {
    id: page.id,
    organizationId: orgIds[0] ?? "",
    contactId: contactIds[0] ?? null,
    campaignId: campaignIds[0] ?? null,
    stepId: stepIds[0] ?? null,
    subject: getTitle(props[P.subject]),
    body: getText(props[P.body]),
    status: getSelect(props[P.status]) as EmailDraftStatus,
    sentAt: getDate(props[P.sentAt])?.start ?? null,
    sentTo: getEmail(props[P.sentTo]) ?? "",
    resendMessageId: getText(props[P.resendMessageId]),
    opens: getNumber(props[P.opens]) ?? 0,
    clicks: getNumber(props[P.clicks]) ?? 0,
    machineOpens: getNumber(props[P.machineOpens]) ?? 0,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryEmailDrafts(
  filters?: { status?: EmailDraftStatus; search?: string },
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.status) nf.push(buildSelectFilter(P.status, filters.status));
    // Search by subject (title field), not resendMessageId
    if (filters.search) nf.push(buildTitleSearch(P.subject, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.emailDrafts,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryEmailDrafts",
  });

  return {
    data: result.pages.map(mapPageToEmailDraft),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getEmailDraft(id: string): Promise<EmailDraft> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToEmailDraft(page);
}

export async function createEmailDraft(
  fields: Pick<EmailDraft, "subject"> & Partial<EmailDraft>,
): Promise<EmailDraft> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.subject]: buildTitle(fields.subject),
  };

  if (fields.body) properties[P.body] = buildRichText(fields.body);
  if (fields.status) properties[P.status] = buildSelect(fields.status);
  if (fields.organizationId) properties[P.organization] = buildRelation([fields.organizationId]);
  if (fields.contactId) properties[P.contact] = buildRelation([fields.contactId]);
  if (fields.campaignId) properties[P.campaignId] = buildRelation([fields.campaignId]);
  if (fields.stepId) properties[P.stepId] = buildRelation([fields.stepId]);
  if (fields.sentAt) properties[P.sentAt] = buildDate({ start: fields.sentAt, end: null });
  if (fields.sentTo) properties[P.sentTo] = buildEmail(fields.sentTo);
  if (fields.resendMessageId) properties[P.resendMessageId] = buildRichText(fields.resendMessageId);
  if (fields.opens !== undefined) properties[P.opens] = buildNumber(fields.opens);
  if (fields.clicks !== undefined) properties[P.clicks] = buildNumber(fields.clicks);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.emailDrafts },
    properties,
  })) as PageObjectResponse;

  return mapPageToEmailDraft(page);
}

export async function updateEmailDraft(
  id: string,
  fields: Partial<EmailDraft>,
): Promise<EmailDraft> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.subject !== undefined) properties[P.subject] = buildTitle(fields.subject);
  if (fields.body !== undefined) properties[P.body] = buildRichText(fields.body);
  if (fields.status !== undefined) properties[P.status] = buildSelect(fields.status);
  if (fields.organizationId !== undefined) properties[P.organization] = buildRelation([fields.organizationId]);
  if (fields.contactId !== undefined) properties[P.contact] = buildRelation(fields.contactId ? [fields.contactId] : []);
  if (fields.campaignId !== undefined) properties[P.campaignId] = buildRelation(fields.campaignId ? [fields.campaignId] : []);
  if (fields.stepId !== undefined) properties[P.stepId] = buildRelation(fields.stepId ? [fields.stepId] : []);
  if (fields.sentAt !== undefined) properties[P.sentAt] = buildDate({ start: fields.sentAt!, end: null });
  if (fields.sentTo !== undefined) properties[P.sentTo] = buildEmail(fields.sentTo);
  if (fields.resendMessageId !== undefined) properties[P.resendMessageId] = buildRichText(fields.resendMessageId);
  if (fields.opens !== undefined) properties[P.opens] = buildNumber(fields.opens);
  if (fields.clicks !== undefined) properties[P.clicks] = buildNumber(fields.clicks);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToEmailDraft(page);
}

/**
 * Find an email draft by Resend message ID.
 * Used by the webhook handler to update tracking metrics.
 * Uses `equals` (not `contains`) to avoid false matches on ID prefix overlap.
 */
export async function findDraftByResendId(resendMessageId: string): Promise<EmailDraft | null> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.emailDrafts,
    filter: buildTextEquals(P.resendMessageId, resendMessageId),
    page_size: 1,
    label: "findDraftByResendId",
  });

  return result.pages.length > 0 ? mapPageToEmailDraft(result.pages[0]) : null;
}

/**
 * Query all email drafts for a specific organization, sorted newest-first.
 * Used for the org-level email history / analytics panel.
 */
export async function queryEmailDraftsByOrg(
  orgId: string,
  pagination?: PaginationParams,
) {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.emailDrafts,
    filter: buildRelationContains(P.organization, orgId),
    sorts: [{ timestamp: "created_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryEmailDraftsByOrg",
  });

  return {
    data: result.pages.map(mapPageToEmailDraft),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

/**
 * Fetch ALL email drafts for a campaign, paginating automatically.
 * Used for per-campaign analytics — avoids the pageSize=100 truncation bug.
 */
export async function queryEmailDraftsByCampaign(campaignId: string): Promise<EmailDraft[]> {
  const all: EmailDraft[] = [];
  let cursor: string | undefined;
  do {
    const result = await queryDatabase(notion, {
      database_id: PORT_DB.emailDrafts,
      filter: buildRelationContains(P.campaignId, campaignId),
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
      label: "queryEmailDraftsByCampaign",
    });
    all.push(...result.pages.map(mapPageToEmailDraft));
    cursor = result.nextCursor ?? undefined;
    if (!result.hasMore) break;
  } while (cursor);
  return all;
}

/**
 * Fetch ALL email drafts for a specific campaign step, paginating automatically.
 * Used by filterByCondition for accurate engagement-based audience branching.
 */
export async function queryEmailDraftsByStep(stepId: string): Promise<EmailDraft[]> {
  const all: EmailDraft[] = [];
  let cursor: string | undefined;
  do {
    const result = await queryDatabase(notion, {
      database_id: PORT_DB.emailDrafts,
      filter: buildRelationContains(P.stepId, stepId),
      sorts: [{ timestamp: "created_time", direction: "descending" }],
      start_cursor: cursor,
      page_size: 100,
      label: "queryEmailDraftsByStep",
    });
    all.push(...result.pages.map(mapPageToEmailDraft));
    cursor = result.nextCursor ?? undefined;
    if (!result.hasMore) break;
  } while (cursor);
  return all;
}

/**
 * Increment the opens counter for an email draft.
 * Re-fetches the live count before writing to mitigate the Notion read-modify-write
 * race condition when multiple webhook events arrive simultaneously.
 */
export async function incrementOpens(id: string): Promise<void> {
  const fresh = await getEmailDraft(id);
  await notion.pages.update({
    page_id: id,
    properties: { [P.opens]: buildNumber(fresh.opens + 1) },
  });
}

/**
 * Increment the machine opens counter for an email draft.
 * Called when an open event is detected as automated (e.g. Apple MPP, security scanner)
 * based on the time delta between sentAt and the open event timestamp being < 60 seconds.
 */
export async function incrementMachineOpens(id: string): Promise<void> {
  const fresh = await getEmailDraft(id);
  await notion.pages.update({
    page_id: id,
    properties: { [P.machineOpens]: buildNumber(fresh.machineOpens + 1) },
  });
}

/**
 * Increment the clicks counter for an email draft.
 * Re-fetches the live count before writing to mitigate the Notion read-modify-write
 * race condition when multiple webhook events arrive simultaneously.
 */
export async function incrementClicks(id: string): Promise<void> {
  const fresh = await getEmailDraft(id);
  await notion.pages.update({
    page_id: id,
    properties: { [P.clicks]: buildNumber(fresh.clicks + 1) },
  });
}
