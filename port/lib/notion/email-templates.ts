/**
 * Email templates data layer.
 */

import {
  getTitle,
  getText,
  getSelect,
  getNumber,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildNumber,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB, EMAIL_TEMPLATE_PROPS } from "./client";
import type {
  EmailTemplate,
  EmailTemplateFilters,
  PaginationParams,
  SortParams,
} from "./types";
import {
  buildSelectFilter,
  buildTitleSearch,
  buildCompoundFilter,
} from "./filters";

const P = EMAIL_TEMPLATE_PROPS;

function mapPageToTemplate(page: PageObjectResponse): EmailTemplate {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    subject: getText(props[P.subject]),
    body: getText(props[P.body]),
    category: getSelect(props[P.category]) as EmailTemplate["category"],
    channel: (getSelect(props[P.channel]) as EmailTemplate["channel"]) || "email",
    notes: getText(props[P.notes]),
    timesUsed: getNumber(props[P.timesUsed]) ?? 0,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

export async function queryEmailTemplates(
  filters?: EmailTemplateFilters,
  pagination?: PaginationParams,
  sort?: SortParams,
) {
  const nf: ReturnType<typeof buildSelectFilter>[] = [];

  if (filters) {
    if (filters.category) nf.push(buildSelectFilter(P.category, filters.category));
    if (filters.channel) nf.push(buildSelectFilter(P.channel, filters.channel));
    if (filters.search) nf.push(buildTitleSearch(P.name, filters.search));
  }

  const result = await queryDatabase(notion, {
    database_id: PORT_DB.emailTemplates,
    filter: buildCompoundFilter(nf),
    sorts: sort
      ? [{ property: sort.property, direction: sort.direction }]
      : [{ timestamp: "last_edited_time", direction: "descending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 50,
    label: "queryEmailTemplates",
  });

  return {
    data: result.pages.map(mapPageToTemplate),
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getEmailTemplate(id: string): Promise<EmailTemplate> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToTemplate(page);
}

export async function createEmailTemplate(
  fields: Partial<EmailTemplate> & Pick<EmailTemplate, "name">,
): Promise<EmailTemplate> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.name]: buildTitle(fields.name),
  };

  if (fields.subject) properties[P.subject] = buildRichText(fields.subject);
  if (fields.body) properties[P.body] = buildRichText(fields.body);
  if (fields.category) properties[P.category] = buildSelect(fields.category);
  if (fields.channel) properties[P.channel] = buildSelect(fields.channel);
  if (fields.notes) properties[P.notes] = buildRichText(fields.notes);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.emailTemplates },
    properties,
  })) as PageObjectResponse;

  return mapPageToTemplate(page);
}

export async function updateEmailTemplate(
  id: string,
  fields: Partial<EmailTemplate>,
): Promise<EmailTemplate> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};

  if (fields.name !== undefined) properties[P.name] = buildTitle(fields.name);
  if (fields.subject !== undefined) properties[P.subject] = buildRichText(fields.subject);
  if (fields.body !== undefined) properties[P.body] = buildRichText(fields.body);
  if (fields.category !== undefined) properties[P.category] = buildSelect(fields.category);
  if (fields.channel !== undefined) properties[P.channel] = buildSelect(fields.channel);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);

  const page = (await notion.pages.update({
    page_id: id,
    properties,
  })) as PageObjectResponse;

  return mapPageToTemplate(page);
}

export async function archiveEmailTemplate(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

/** Get all email templates (active + inactive) — used by the Supabase sync cron. */
export async function getAllEmailTemplates(): Promise<EmailTemplate[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.emailTemplates,
    sorts: [{ timestamp: "last_edited_time", direction: "descending" }],
    page_size: 100,
    label: "getAllEmailTemplates",
  });
  return result.pages.map(mapPageToTemplate);
}

/** Increment the times-used counter. Fire-and-forget safe. */
export async function incrementTimesUsed(id: string): Promise<void> {
  const template = await getEmailTemplate(id);
  await notion.pages.update({
    page_id: id,
    properties: {
      [P.timesUsed]: buildNumber((template.timesUsed ?? 0) + 1),
    },
  });
}
