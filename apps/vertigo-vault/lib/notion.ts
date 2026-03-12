import { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";

/**
 * Lazy-initialised Notion client.
 * Deferred so `next build` doesn't throw when env vars are missing
 * during static page data collection.
 */
let _notion: Client | null = null;

function getNotion(): Client {
  if (!_notion) {
    if (!process.env.NOTION_TOKEN) {
      throw new Error("NOTION_TOKEN environment variable is required");
    }
    _notion = new Client({ auth: process.env.NOTION_TOKEN });
  }
  return _notion;
}

export { getNotion as notion };

/** Vault only needs the single vault database ID. */
export const NOTION_DBS = {
  vault: process.env.NOTION_DB_VAULT ?? "",
} as const;

// Notion rate limit: 3 req/s. We use 350ms delay for safety.
export const RATE_LIMIT_DELAY_MS = 350;

export async function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Paginate through all results of a Notion database query.
 */
export async function queryAllPages(
  databaseId: string,
): Promise<PageObjectResponse[]> {
  const client = getNotion();
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined = undefined;

  do {
    await delay(RATE_LIMIT_DELAY_MS);
    const response: QueryDatabaseResponse = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });
    pages.push(
      ...(response.results as PageObjectResponse[]),
    );
    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}
