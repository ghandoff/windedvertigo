/**
 * Meeting notes auto-ingest pipeline.
 *
 * Scans recently-edited Notion pages matching "meeting notes", extracts
 * action items via Claude, and creates work items in the tasks database.
 *
 * Env vars:
 *   MEETING_NOTES_LOOKBACK_HOURS — how far back to scan (default 6)
 */

import { notion } from "@/lib/notion/client";
import { extractMeetingActions, type ExtractedAction } from "@/lib/ai/meeting-actions";
import { createWorkItem } from "@/lib/notion/work-items";
import { queryWorkItems } from "@/lib/notion/work-items";
import { queryProjects } from "@/lib/notion/projects";
import { getActiveMembers, type Member } from "@/lib/notion/members";
import { postToSlack } from "@/lib/slack";
import type { WorkItemType, WorkItemPriority } from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────

export interface IngestResult {
  pagesScanned: number;
  pagesProcessed: number;
  pagesSkipped: number;
  workItemsCreated: number;
  errors: string[];
}

interface NotionSearchPage {
  id: string;
  object: "page";
  last_edited_time: string;
  properties?: Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

// ── helpers ──────────────────────────────────────────────

const TITLE_NOISE = /\b(meeting notes|weekly|sync|standup|check-in|check in|recap|debrief|:)\b/gi;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPageTitle(page: NotionSearchPage): string {
  if (!page.properties) return "";
  for (const prop of Object.values(page.properties)) {
    const p = prop as { type?: string; title?: Array<{ plain_text: string }> };
    if (p.type === "title" && p.title?.length) {
      return p.title.map((t) => t.plain_text).join("");
    }
  }
  return "";
}

function extractProjectKeyword(title: string): string | null {
  const cleaned = title.replace(TITLE_NOISE, "").trim();
  // Take the first meaningful word (3+ chars) as a project keyword
  const words = cleaned.split(/\s+/).filter((w) => w.length >= 3);
  return words[0] ?? null;
}

/** Map the AI's action type to a valid WorkItemType. */
function mapActionType(aiType: ExtractedAction["type"]): WorkItemType {
  const mapping: Record<ExtractedAction["type"], WorkItemType> = {
    plan: "plan",
    implement: "implement",
    coordinate: "coordinate",
    review: "review",
    admin: "admin",
  };
  return mapping[aiType] ?? "admin";
}

/** Map the AI's priority to a valid WorkItemPriority. */
function mapPriority(aiPriority: ExtractedAction["priority"]): WorkItemPriority {
  const mapping: Record<ExtractedAction["priority"], WorkItemPriority> = {
    low: "low",
    medium: "medium",
    high: "high",
  };
  return mapping[aiPriority] ?? "medium";
}

// ── block text extraction ────────────────────────────────

const TEXT_BLOCK_TYPES = new Set([
  "paragraph",
  "heading_1",
  "heading_2",
  "heading_3",
  "bulleted_list_item",
  "numbered_list_item",
  "callout",
  "quote",
  "toggle",
  "to_do",
]);

async function extractBlockText(pageId: string): Promise<string> {
  const parts: string[] = [];
  let cursor: string | undefined;

  // Paginate through blocks (up to 300 blocks = 3 pages of 100)
  for (let page = 0; page < 3; page++) {
    const response = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100,
      ...(cursor ? { start_cursor: cursor } : {}),
    });

    for (const block of response.results) {
      const b = block as { type?: string; [key: string]: unknown };
      if (!b.type || !TEXT_BLOCK_TYPES.has(b.type)) continue;

      const content = b[b.type] as { rich_text?: Array<{ plain_text: string }> };
      if (content?.rich_text?.length) {
        parts.push(content.rich_text.map((t) => t.plain_text).join(""));
      }
    }

    if (!response.has_more || !response.next_cursor) break;
    cursor = response.next_cursor;
    await delay(300);
  }

  return parts.join("\n");
}

// ── dedup check ──────────────────────────────────────────

async function isDuplicate(title: string): Promise<boolean> {
  // Search for work items with similar title created in last 48 hours
  const searchTerm = title.slice(0, 60);
  try {
    const result = await queryWorkItems({ search: searchTerm }, { pageSize: 5 });
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    return result.data.some((item) => item.createdTime > cutoff);
  } catch {
    // If dedup check fails, proceed (don't block ingest)
    return false;
  }
}

// ── owner resolution ─────────────────────────────────────

function resolveOwnerIds(
  ownerName: string,
  members: Member[],
): string[] {
  if (!ownerName || ownerName === "unassigned") return [];

  const normalized = ownerName.toLowerCase().trim();
  const match = members.find(
    (m) => m.name.toLowerCase().startsWith(normalized) ||
      m.name.split(" ")[0].toLowerCase() === normalized,
  );

  return match ? [match.id] : [];
}

// ── main orchestration ───────────────────────────────────

export async function ingestMeetingNotes(): Promise<IngestResult> {
  const lookbackHours = parseInt(process.env.MEETING_NOTES_LOOKBACK_HOURS ?? "6", 10);
  const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

  const result: IngestResult = {
    pagesScanned: 0,
    pagesProcessed: 0,
    pagesSkipped: 0,
    workItemsCreated: 0,
    errors: [],
  };

  // 1. Search for recently-edited meeting notes pages
  const searchResponse = await notion.search({
    query: "meeting notes",
    filter: { value: "page", property: "object" },
    sort: { direction: "descending", timestamp: "last_edited_time" },
    page_size: 20,
  });

  const pages = (searchResponse.results as NotionSearchPage[]).filter(
    (p) => p.object === "page" && new Date(p.last_edited_time) > cutoff,
  );

  result.pagesScanned = pages.length;

  if (pages.length === 0) {
    console.log("[meeting-ingest] no recently-edited meeting notes found");
    return result;
  }

  // Pre-fetch members once for owner resolution
  const members = await getActiveMembers();
  await delay(300);

  const processedIds = new Set<string>();
  const slackLines: string[] = [];

  // 2. Process each page sequentially
  for (const page of pages) {
    if (processedIds.has(page.id)) {
      result.pagesSkipped++;
      continue;
    }
    processedIds.add(page.id);

    const title = getPageTitle(page);

    try {
      // 2a. Extract block text
      const text = await extractBlockText(page.id);
      await delay(300);

      // 2b. Skip if too short or no action items mentioned
      if (text.length < 200 || !text.toLowerCase().includes("action item")) {
        console.log(`[meeting-ingest] skipping "${title}" — too short or no action items`);
        result.pagesSkipped++;
        continue;
      }

      // 2c. Dedup check
      const titleSubstring = title.slice(0, 40);
      if (titleSubstring && await isDuplicate(titleSubstring)) {
        console.log(`[meeting-ingest] skipping "${title}" — duplicate detected`);
        result.pagesSkipped++;
        await delay(300);
        continue;
      }
      await delay(300);

      // 2d. Extract actions via Claude (truncate long transcripts)
      const truncatedText = text.slice(0, 12000);
      const extraction = await extractMeetingActions(truncatedText, "cron");

      if (extraction.actions.length === 0) {
        console.log(`[meeting-ingest] skipping "${title}" — 0 actions extracted`);
        result.pagesSkipped++;
        continue;
      }

      // 2e. Match to a project
      const keyword = extractProjectKeyword(title);
      let projectIds: string[] = [];

      if (keyword) {
        try {
          const projects = await queryProjects({ search: keyword }, { pageSize: 3 });
          if (projects.data.length > 0) {
            projectIds = [projects.data[0].id];
          }
          await delay(300);
        } catch {
          // Project matching is best-effort
        }
      }

      // 2f-g. Create work items for each action
      let pageItemCount = 0;

      for (const action of extraction.actions) {
        try {
          const ownerIds = resolveOwnerIds(action.owner, members);

          await createWorkItem({
            task: action.title,
            status: "in queue",
            taskType: mapActionType(action.type),
            priority: mapPriority(action.priority),
            ownerIds,
            projectIds,
            dueDate: action.deadline ? { start: action.deadline, end: null } : null,
          });

          result.workItemsCreated++;
          pageItemCount++;
          await delay(300);
        } catch (err) {
          const msg = `failed to create work item "${action.title}": ${err instanceof Error ? err.message : String(err)}`;
          console.warn(`[meeting-ingest] ${msg}`);
          result.errors.push(msg);
        }
      }

      result.pagesProcessed++;
      slackLines.push(
        `- *${title}*: ${pageItemCount} work item${pageItemCount === 1 ? "" : "s"} created` +
          (projectIds.length ? ` (matched project)` : ""),
      );

      console.log(`[meeting-ingest] processed "${title}" — ${pageItemCount} items created`);
    } catch (err) {
      const msg = `error processing page "${title}": ${err instanceof Error ? err.message : String(err)}`;
      console.warn(`[meeting-ingest] ${msg}`);
      result.errors.push(msg);
      result.pagesSkipped++;
    }
  }

  // 3. Post Slack summary
  if (result.workItemsCreated > 0) {
    const summary = [
      `*Meeting Notes Ingest*`,
      `Scanned ${result.pagesScanned} page${result.pagesScanned === 1 ? "" : "s"}, ` +
        `created ${result.workItemsCreated} work item${result.workItemsCreated === 1 ? "" : "s"}:`,
      ...slackLines,
      result.errors.length > 0
        ? `\n_${result.errors.length} error${result.errors.length === 1 ? "" : "s"} occurred — check logs._`
        : "",
      `\n_port.windedvertigo.com/pm/tasks_`,
    ]
      .filter(Boolean)
      .join("\n");

    await postToSlack(summary);
  }

  return result;
}
