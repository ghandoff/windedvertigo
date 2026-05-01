/**
 * Content calendar data layer.
 *
 * The content calendar DB is created by Cowork once the CMO dispatch is active.
 * Until NOTION_CONTENT_CALENDAR_DB_ID is set, all writes/reads return null/empty.
 */

import { getTitle, getSelect, getDate, getRichTextAsMarkdown, queryDatabase, type PageObjectResponse } from "@/lib/shared/notion";
import { notion, PORT_DB } from "./client";

export type ContentStatus = "idea" | "draft" | "review" | "approved" | "scheduled" | "published";
export type ContentChannel = "linkedin" | "bluesky" | "twitter" | "newsletter" | "blog" | "website";

export interface ContentDraft {
  id: string;
  title: string;
  channel: ContentChannel;
  body?: string;
  scheduledDate?: string;
  status: ContentStatus;
  author?: string;
}

export interface CreateContentInput {
  title: string;
  channel: ContentChannel;
  body?: string;
  scheduledDate?: string;
  status?: ContentStatus;
  author?: string;
}

// ── read ──────────────────────────────────────────────────────

function mapPageToContent(page: PageObjectResponse): ContentDraft {
  const props = page.properties;
  return {
    id: page.id,
    title: getTitle(props["title"]) || "Untitled",
    channel: (getSelect(props["channel"]) ?? "linkedin") as ContentChannel,
    body: getRichTextAsMarkdown(props["body"]) || undefined,
    scheduledDate: getDate(props["scheduled date"])?.start ?? undefined,
    status: (getSelect(props["status"]) ?? "draft") as ContentStatus,
    author: getSelect(props["author"]) || undefined,
  };
}

export async function queryContentDrafts(): Promise<ContentDraft[] | null> {
  if (!PORT_DB.contentCalendar) return null;
  try {
    const result = await queryDatabase(notion, {
      database_id: PORT_DB.contentCalendar,
      filter: {
        property: "status",
        select: { does_not_equal: "published" },
      },
      sorts: [{ property: "scheduled date", direction: "ascending" }],
      page_size: 30,
      label: "port:queryContentDrafts",
    });
    return result.pages.map(mapPageToContent);
  } catch (err) {
    console.error("[port] queryContentDrafts:", err);
    return null;
  }
}

// ── write ──────────────────────────────────────────────────────

export async function createContentDraft(input: CreateContentInput): Promise<ContentDraft | null> {
  if (!PORT_DB.contentCalendar) return null;
  try {
    const page = await notion.pages.create({
      parent: { database_id: PORT_DB.contentCalendar, type: "database_id" },
      properties: {
        title: { title: [{ text: { content: input.title } }] },
        channel: { select: { name: input.channel } },
        status: { select: { name: input.status ?? "draft" } },
        ...(input.body
          ? { body: { rich_text: [{ text: { content: input.body.slice(0, 2000) } }] } }
          : {}),
        ...(input.scheduledDate
          ? { "scheduled date": { date: { start: input.scheduledDate } } }
          : {}),
        ...(input.author
          ? { author: { select: { name: input.author } } }
          : {}),
      },
    });
    return mapPageToContent(page as PageObjectResponse);
  } catch (err) {
    console.error("[port] createContentDraft:", err);
    return null;
  }
}
