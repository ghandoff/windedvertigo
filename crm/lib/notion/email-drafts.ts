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
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildDate,
  buildNumber,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, EMAIL_DRAFT_PROPS } from "./client";
import type { EmailDraft, EmailDraftStatus, PaginationParams, SortParams } from "./types";
import { buildSelectFilter, buildTextSearch, buildCompoundFilter } from "./filters";

const P = EMAIL_DRAFT_PROPS;

function mapPageToEmailDraft(page: PageObjectResponse): EmailDraft {
  const props = page.properties;
  const orgIds = getRelation(props[P.organization]);
  return {
    id: page.id,
    organizationId: orgIds[0] ?? "",
    subject: getTitle(props[P.subject]),
    body: getText(props[P.body]),
    status: getSelect(props[P.status]) as EmailDraftStatus,
    sentAt: getDate(props[P.sentAt])?.start ?? null,
    resendMessageId: getText(props[P.resendMessageId]),
    opens: getNumber(props[P.opens]) ?? 0,
    clicks: getNumber(props[P.clicks]) ?? 0,
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
    if (filters.search) nf.push(buildTextSearch(P.resendMessageId, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.emailDrafts,
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
  if (fields.sentAt) properties[P.sentAt] = buildDate({ start: fields.sentAt, end: null });
  if (fields.resendMessageId) properties[P.resendMessageId] = buildRichText(fields.resendMessageId);
  if (fields.opens !== undefined) properties[P.opens] = buildNumber(fields.opens);
  if (fields.clicks !== undefined) properties[P.clicks] = buildNumber(fields.clicks);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.emailDrafts },
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
  if (fields.sentAt !== undefined) properties[P.sentAt] = buildDate({ start: fields.sentAt!, end: null });
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
 */
export async function findDraftByResendId(resendMessageId: string): Promise<EmailDraft | null> {
  const result = await queryDatabase(notion, {
    database_id: CRM_DB.emailDrafts,
    filter: buildTextSearch(P.resendMessageId, resendMessageId),
    page_size: 1,
    label: "findDraftByResendId",
  });

  return result.pages.length > 0 ? mapPageToEmailDraft(result.pages[0]) : null;
}

/** Increment the opens counter for an email draft. */
export async function incrementOpens(id: string, currentOpens: number): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: { [P.opens]: buildNumber(currentOpens + 1) },
  });
}

/** Increment the clicks counter for an email draft. */
export async function incrementClicks(id: string, currentClicks: number): Promise<void> {
  await notion.pages.update({
    page_id: id,
    properties: { [P.clicks]: buildNumber(currentClicks + 1) },
  });
}
