import { Client } from "@notionhq/client";

/**
 * Lazy-initialised Notion client.
 * Module-level throws break `next build` (page data collection imports
 * the module even without env vars), so we defer the check to first use.
 */
let _notion: Client | null = null;

function getNotion(): Client {
  if (!_notion) {
    if (!process.env.NOTION_API_KEY) {
      throw new Error("NOTION_API_KEY environment variable is required");
    }
    _notion = new Client({ auth: process.env.NOTION_API_KEY });
  }
  return _notion;
}

export { getNotion as notion };

export const NOTION_DBS = {
  patterns: process.env.NOTION_DB_PATTERNS ?? "",
  materials: process.env.NOTION_DB_MATERIALS ?? "",
  packs: process.env.NOTION_DB_PACKS ?? "",
  runs: process.env.NOTION_DB_RUNS ?? "",
} as const;

// Notion rate limit: 3 req/s. We use 350ms delay for safety.
export const RATE_LIMIT_DELAY_MS = 350;

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Paginate through all results of a Notion database query.
 */
export async function queryAllPages(databaseId: string) {
  const client = getNotion();
  const pages: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    await delay(RATE_LIMIT_DELAY_MS);
    const response: any = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);

  return pages;
}
