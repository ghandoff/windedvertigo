/**
 * Social media drafting queue data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getDate,
  getRelation,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildDate,
  buildRelation,
  type PageObjectResponse,
} from "@windedvertigo/notion";

import { notion, CRM_DB, SOCIAL_PROPS } from "./client";
import type { SocialDraft, SocialPlatform, SocialDraftStatus, PaginationParams, SortParams } from "./types";
import { buildSelectFilter, buildTitleSearch, buildCompoundFilter } from "./filters";

const P = SOCIAL_PROPS;

function mapPageToSocialDraft(page: PageObjectResponse): SocialDraft {
  const props = page.properties;
  const orgIds = getRelation(props[P.organization]);
  return {
    id: page.id,
    content: getTitle(props[P.content]),
    platform: getSelect(props[P.platform]) as SocialPlatform,
    status: getSelect(props[P.status]) as SocialDraftStatus,
    mediaUrls: getText(props[P.mediaUrls]),
    scheduledFor: getDate(props[P.scheduledFor]),
    organizationId: orgIds[0] ?? "",
    notes: getText(props[P.notes]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function querySocialDrafts(
  filters?: { platform?: SocialPlatform; status?: SocialDraftStatus; search?: string },
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.platform) nf.push(buildSelectFilter(P.platform, filters.platform));
    if (filters.status) nf.push(buildSelectFilter(P.status, filters.status));
    if (filters.search) nf.push(buildTitleSearch(P.content, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: CRM_DB.socialQueue,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "querySocialDrafts",
  });

  return {
    data: result.pages.map(mapPageToSocialDraft),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getSocialDraft(id: string): Promise<SocialDraft> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToSocialDraft(page);
}

export async function createSocialDraft(
  fields: Partial<SocialDraft> & Pick<SocialDraft, "content">,
): Promise<SocialDraft> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.content]: buildTitle(fields.content),
  };

  if (fields.platform) properties[P.platform] = buildSelect(fields.platform);
  if (fields.status) properties[P.status] = buildSelect(fields.status);
  if (fields.mediaUrls) properties[P.mediaUrls] = buildRichText(fields.mediaUrls);
  if (fields.scheduledFor) properties[P.scheduledFor] = buildDate(fields.scheduledFor);
  if (fields.organizationId) properties[P.organization] = buildRelation([fields.organizationId]);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);

  const page = (await notion.pages.create({
    parent: { data_source_id: CRM_DB.socialQueue },
    properties,
  })) as PageObjectResponse;

  return mapPageToSocialDraft(page);
}

export async function updateSocialDraft(
  id: string,
  fields: Partial<SocialDraft>,
): Promise<SocialDraft> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.content !== undefined) properties[P.content] = buildTitle(fields.content);
  if (fields.platform !== undefined) properties[P.platform] = buildSelect(fields.platform);
  if (fields.status !== undefined) properties[P.status] = buildSelect(fields.status);
  if (fields.mediaUrls !== undefined) properties[P.mediaUrls] = buildRichText(fields.mediaUrls);
  if (fields.scheduledFor !== undefined) properties[P.scheduledFor] = buildDate(fields.scheduledFor);
  if (fields.organizationId !== undefined) properties[P.organization] = buildRelation([fields.organizationId]);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToSocialDraft(page);
}

export async function archiveSocialDraft(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, archived: true });
}
