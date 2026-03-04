import { Client } from "@notionhq/client";
import type { VaultActivity } from "./types";

const VAULT_DB_ID = "223e4ee74ba4805f8c92cda6e2b8ba00";

const PROP_MAP = {
  name: "name",
  headline: "headline",
  duration: "duration",
  format: "format",
  type: "type",
  skillsDeveloped: "skills developed",
  filesMedia: "files & media",
} as const;

/* ------------------------------------------------------------------ */
/*  Notion helpers                                                     */
/* ------------------------------------------------------------------ */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTitleValue(prop: any): string {
  if (!prop || prop.type !== "title") return "";
  return prop.title?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getTextValue(prop: any): string | null {
  if (!prop || prop.type !== "rich_text") return null;
  const text = prop.rich_text?.map((t: { plain_text: string }) => t.plain_text).join("") ?? "";
  return text || null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSelectValue(prop: any): string | null {
  if (!prop || prop.type !== "select") return null;
  return prop.select?.name ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getMultiSelectValue(prop: any): string[] {
  if (!prop || prop.type !== "multi_select") return [];
  return (prop.multi_select ?? []).map((o: { name: string }) => o.name);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCoverUrl(page: any): string | null {
  const cover = page.cover;
  if (!cover) return null;
  if (cover.type === "external") return cover.external?.url ?? null;
  if (cover.type === "file") return cover.file?.url ?? null;
  return null;
}

/** Run async tasks in batches of `n` to respect Notion's 3 req/sec rate limit. */
async function batchConcurrent<T>(
  items: T[],
  n: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += n) {
    await Promise.allSettled(items.slice(i, i + n).map(fn));
  }
}

/* ------------------------------------------------------------------ */
/*  Block → Markdown                                                   */
/* ------------------------------------------------------------------ */

interface RichTextAnnotations {
  bold?: boolean;
  italic?: boolean;
}

interface RichTextItem {
  plain_text: string;
  annotations?: RichTextAnnotations;
}

function richTextToPlain(richText: RichTextItem[] | undefined): string {
  if (!richText) return "";
  return richText
    .map((t) => {
      let text = t.plain_text;
      if (t.annotations?.bold) text = `**${text}**`;
      if (t.annotations?.italic) text = `*${text}*`;
      return text;
    })
    .join("");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function blocksToMarkdown(blocks: any[]): string {
  let md = "";
  for (const block of blocks) {
    const text = richTextToPlain(block[block.type]?.rich_text);
    switch (block.type) {
      case "heading_2":
        md += `## ${text}\n`;
        break;
      case "heading_3":
        md += `### ${text}\n`;
        break;
      case "paragraph":
        if (text) md += `${text}\n`;
        break;
      case "numbered_list_item":
        md += `1. ${text}\n`;
        break;
      case "bulleted_list_item":
        md += `- ${text}\n`;
        break;
      default:
        if (text) md += `${text}\n`;
    }
  }
  return md.trim();
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

let _client: Client | null = null;

function notion(): Client {
  if (!_client) {
    const token = process.env.NOTION_TOKEN;
    if (!token) throw new Error("NOTION_TOKEN env var is required");
    _client = new Client({ auth: token });
  }
  return _client;
}

/**
 * Fetch every activity from the Vertigo Vault database.
 *
 * Phase 1: Paginated databases.query() to collect all pages.
 * Phase 2: Extract properties into activity stubs (no extra API calls).
 * Phase 3: Fetch block content concurrently in batches of 3 (Notion rate limit).
 */
export async function fetchVaultActivities(): Promise<VaultActivity[]> {
  // Phase 1 — collect all raw pages
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rawPages: any[] = [];
  let cursor: string | undefined;

  do {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response: any = await notion().databases.query({
      database_id: VAULT_DB_ID,
      start_cursor: cursor,
      page_size: 100,
      // Only fetch PRME-tier activities (contractual deliverable).
      // All 22 PRME activities are tagged — no is_empty fallback needed.
      filter: {
        property: "tier",
        select: { equals: "prme" },
      },
    });
    rawPages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  // Phase 2 — map properties into activity stubs (content empty for now)
  const stubs = rawPages
    .map((page) => {
      const props = page.properties;
      const name = getTitleValue(props[PROP_MAP.name]);
      if (!name) return null;
      return {
        pageId: page.id as string,
        activity: {
          id: page.id,
          name,
          headline: getTextValue(props[PROP_MAP.headline]),
          duration: getSelectValue(props[PROP_MAP.duration]),
          format: getMultiSelectValue(props[PROP_MAP.format]),
          type: getMultiSelectValue(props[PROP_MAP.type]),
          skillsDeveloped: getMultiSelectValue(props[PROP_MAP.skillsDeveloped]),
          coverImage: getCoverUrl(page),
          content: "",
        } satisfies VaultActivity,
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  // Phase 3 — fetch block content in concurrent batches of 3
  await batchConcurrent(stubs, 3, async (stub) => {
    try {
      const blocks = await notion().blocks.children.list({
        block_id: stub.pageId,
        page_size: 100,
      });
      stub.activity.content = blocksToMarkdown(blocks.results);
    } catch {
      // Non-fatal — card still renders without instructions
    }
  });

  return stubs.map((s) => s.activity);
}
