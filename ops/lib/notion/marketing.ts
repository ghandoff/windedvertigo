/**
 * Marketing data fetches for the ops dashboard.
 *
 * content-calendar DB: created by Cowork when the CMO dispatch is active.
 * Until then, fetchContentCalendar returns null and the caller uses static/KV data.
 *
 * pipeline summary: reads from the port CRM's deals DB (same NOTION_TOKEN).
 */

import { getTitle, getSelect, getDate, getRichTextAsMarkdown, queryDatabase, type PageObjectResponse } from "@windedvertigo/notion";
import { notion } from "./client";
import type { ContentItem, PipelineSummary } from "../types";

// Set by Cowork when the content calendar DB is created.
const CONTENT_CALENDAR_DB_ID = process.env.NOTION_CONTENT_CALENDAR_DB_ID ?? "";

// Port CRM deals DB — same token, different DB.
const DEALS_DB_ID = "7a76db3a-f9bc-4914-9fec-4873a720520d";

const DEAL_STAGE_PROP = "stage";

// ── content calendar ──────────────────────────────────────────

function mapPageToContentItem(page: PageObjectResponse): ContentItem {
  const props = page.properties;
  return {
    id: page.id,
    title: getTitle(props["title"]) || "Untitled",
    channel: (getSelect(props["channel"]) ?? "linkedin") as ContentItem["channel"],
    body: getRichTextAsMarkdown(props["body"]) || undefined,
    scheduledDate: getDate(props["scheduled date"])?.start ?? new Date().toISOString().slice(0, 10),
    status: (getSelect(props["status"]) ?? "draft") as ContentItem["status"],
    author: getSelect(props["author"]) || undefined,
  };
}

export async function fetchContentCalendar(): Promise<ContentItem[] | null> {
  if (!CONTENT_CALENDAR_DB_ID) return null;
  try {
    const now = new Date().toISOString().slice(0, 10);
    const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const result = await queryDatabase(notion, {
      database_id: CONTENT_CALENDAR_DB_ID,
      filter: {
        and: [
          { property: "scheduled date", date: { on_or_after: now } },
          { property: "scheduled date", date: { on_or_before: twoWeeksOut } },
        ],
      },
      sorts: [{ property: "scheduled date", direction: "ascending" }],
      page_size: 20,
      label: "ops:fetchContentCalendar",
    });
    return result.pages.map(mapPageToContentItem);
  } catch (err) {
    console.error("[ops] fetchContentCalendar:", err);
    return null;
  }
}

// ── pipeline summary from CRM deals ──────────────────────────

export async function fetchPipelineSummary(): Promise<PipelineSummary | null> {
  try {
    const result = await queryDatabase(notion, {
      database_id: DEALS_DB_ID,
      filter: {
        property: DEAL_STAGE_PROP,
        select: { does_not_equal: "" },
      },
      page_size: 100,
      label: "ops:fetchPipelineSummary",
    });

    const counts: PipelineSummary = { identified: 0, pitched: 0, proposal: 0, won: 0, lost: 0 };
    for (const page of result.pages) {
      const stage = getSelect((page as PageObjectResponse).properties[DEAL_STAGE_PROP])?.toLowerCase() ?? "";
      if (stage.includes("identified") || stage.includes("lead")) counts.identified++;
      else if (stage.includes("pitch") || stage.includes("contact")) counts.pitched++;
      else if (stage.includes("proposal") || stage.includes("negotiat")) counts.proposal++;
      else if (stage === "won" || stage.includes("closed won")) counts.won++;
      else if (stage === "lost" || stage.includes("closed lost")) counts.lost++;
      else counts.identified++;
    }
    return counts;
  } catch (err) {
    console.error("[ops] fetchPipelineSummary:", err);
    return null;
  }
}
