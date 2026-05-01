/**
 * RFP feed sources data layer.
 *
 * CRUD for the "RFP feed sources" Notion database.
 * Each record is an RSS/Atom feed URL or Google Alert feed URL
 * that the daily RSS poller reads and ingests into the RFP radar.
 */

import {
  getTitle,
  getText,
  getSelect,
  getCheckbox,
  getUrl,
  getNumber,
  getDate,
  queryDatabase,
  buildTitle,
  buildRichText,
  buildSelect,
  buildCheckbox,
  buildUrl,
  buildNumber,
  buildDate,
  type PageObjectResponse,
} from "@/lib/shared/notion";

import { notion, PORT_DB } from "./client";
import type { RfpSource, PaginationParams } from "./types";

// ── types ─────────────────────────────────────────────────

export type FeedType = "RSS Feed" | "Google Alert" | "Procurement DB" | "Keyword Search";

export interface RfpFeedSource {
  id: string;
  name: string;
  type: FeedType;
  sourceLabel: RfpSource;
  url: string;
  keywords: string;
  notes: string;
  enabled: boolean;
  lastPolled: string | null;
  itemsLastRun: number | null;
  createdTime: string;
  lastEditedTime: string;
}

// ── property map ──────────────────────────────────────────

const P = {
  name: "name",
  type: "type",
  sourceLabel: "source label",
  url: "url",
  keywords: "keywords",
  notes: "notes",
  enabled: "enabled",
  lastPolled: "last polled",
  itemsLastRun: "items last run",
} as const;

// ── mapper ────────────────────────────────────────────────

function mapPageToFeed(page: PageObjectResponse): RfpFeedSource {
  const props = page.properties;
  return {
    id: page.id,
    name: getTitle(props[P.name]),
    type: getSelect(props[P.type]) as FeedType,
    sourceLabel: getSelect(props[P.sourceLabel]) as RfpSource,
    url: getUrl(props[P.url]),
    keywords: getText(props[P.keywords]),
    notes: getText(props[P.notes]),
    enabled: getCheckbox(props[P.enabled]),
    lastPolled: getDate(props[P.lastPolled])?.start ?? null,
    itemsLastRun: getNumber(props[P.itemsLastRun]),
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// ── queries ───────────────────────────────────────────────

export async function queryRfpFeedSources(
  onlyEnabled = false,
  pagination?: PaginationParams,
): Promise<{ data: RfpFeedSource[]; nextCursor: string | null; hasMore: boolean }> {
  // Fetch all rows and filter enabled in-process.
  // The feed sources table is small (<50 rows) so this is fine.
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.rfpFeeds,
    sorts: [{ property: P.type, direction: "ascending" }, { property: P.name, direction: "ascending" }],
    start_cursor: pagination?.cursor,
    page_size: pagination?.pageSize ?? 100,
    label: "queryRfpFeedSources",
  });

  const allFeeds = result.pages.map(mapPageToFeed);
  const data = onlyEnabled ? allFeeds.filter((f) => f.enabled) : allFeeds;

  return {
    data,
    nextCursor: result.nextCursor,
    hasMore: result.hasMore,
  };
}

export async function getRfpFeedSource(id: string): Promise<RfpFeedSource> {
  const page = (await notion.pages.retrieve({ page_id: id })) as PageObjectResponse;
  return mapPageToFeed(page);
}

// ── mutations ─────────────────────────────────────────────

export async function createRfpFeedSource(
  fields: Partial<RfpFeedSource> & Pick<RfpFeedSource, "name">,
): Promise<RfpFeedSource> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {
    [P.name]: buildTitle(fields.name),
  };
  if (fields.type) properties[P.type] = buildSelect(fields.type);
  if (fields.sourceLabel) properties[P.sourceLabel] = buildSelect(fields.sourceLabel);
  if (fields.url !== undefined) properties[P.url] = buildUrl(fields.url);
  if (fields.keywords !== undefined) properties[P.keywords] = buildRichText(fields.keywords);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.enabled !== undefined) properties[P.enabled] = buildCheckbox(fields.enabled);

  const page = (await notion.pages.create({
    parent: { data_source_id: PORT_DB.rfpFeeds },
    properties,
  })) as PageObjectResponse;

  return mapPageToFeed(page);
}

export async function updateRfpFeedSource(
  id: string,
  fields: Partial<RfpFeedSource>,
): Promise<RfpFeedSource> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const properties: Record<string, any> = {};
  if (fields.name !== undefined) properties[P.name] = buildTitle(fields.name);
  if (fields.type !== undefined) properties[P.type] = buildSelect(fields.type);
  if (fields.sourceLabel !== undefined) properties[P.sourceLabel] = buildSelect(fields.sourceLabel);
  if (fields.url !== undefined) properties[P.url] = buildUrl(fields.url);
  if (fields.keywords !== undefined) properties[P.keywords] = buildRichText(fields.keywords);
  if (fields.notes !== undefined) properties[P.notes] = buildRichText(fields.notes);
  if (fields.enabled !== undefined) properties[P.enabled] = buildCheckbox(fields.enabled);
  if (fields.lastPolled !== undefined) {
    properties[P.lastPolled] = fields.lastPolled
      ? buildDate({ start: fields.lastPolled, end: null })
      : null;
  }
  if (fields.itemsLastRun !== undefined) {
    properties[P.itemsLastRun] = fields.itemsLastRun !== null
      ? buildNumber(fields.itemsLastRun)
      : null;
  }

  const page = (await notion.pages.update({ page_id: id, properties })) as PageObjectResponse;
  return mapPageToFeed(page);
}

export async function deleteRfpFeedSource(id: string): Promise<void> {
  await notion.pages.update({ page_id: id, in_trash: true });
}

// ── bulk fetch (used by Supabase sync cron) ───────────────

export async function getAllRfpFeedSources(): Promise<RfpFeedSource[]> {
  const result = await queryDatabase(notion, {
    database_id: PORT_DB.rfpFeeds,
    sorts: [{ property: P.name, direction: "ascending" }],
    page_size: 100,
    label: "getAllRfpFeedSources",
  });
  return result.pages.map(mapPageToFeed);
}
