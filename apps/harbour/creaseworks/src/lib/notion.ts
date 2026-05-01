import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { queryDataSource } from "@windedvertigo/notion-adapter";

/**
 * Lazy-initialised Notion client.
 * Module-level throws break `next build` (page data collection imports
 * the module even without env vars), so we defer the check to first use.
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

export const NOTION_DBS = {
  playdates: process.env.NOTION_DB_PLAYDATES ?? "",
  materials: process.env.NOTION_DB_MATERIALS ?? "",
  packs: process.env.NOTION_DB_PACKS ?? "",
  reflections: process.env.NOTION_DB_REFLECTIONS ?? "",
  collections: process.env.NOTION_DB_COLLECTIONS ?? "",
  siteCopy: process.env.NOTION_DB_SITE_COPY ?? "",
  appConfig: process.env.NOTION_DB_APP_CONFIG ?? "",
} as const;

/**
 * CMS page configuration.
 *
 * Maps a URL slug to a Notion page ID. These are individual Notion pages
 * (not database rows) that serve as a lightweight CMS for static content
 * like the /we/ and /do/ marketing pages.
 *
 * Set via NOTION_CMS_PAGE_{SLUG} environment variables. Pages with empty
 * IDs are silently skipped during sync, so this is safe even when env
 * vars aren't set.
 */
export interface CmsPageConfig {
  slug: string;
  notionPageId: string;
}

export function getCmsPageConfigs(): CmsPageConfig[] {
  return [
    { slug: "we", notionPageId: process.env.NOTION_CMS_PAGE_WE ?? "" },
    { slug: "do", notionPageId: process.env.NOTION_CMS_PAGE_DO ?? "" },
  ].filter((c) => c.notionPageId.length > 0);
}

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
    const response = await queryDataSource(client, {
      databaseId,
      pageSize: 100,
      ...(cursor !== undefined ? { startCursor: cursor } : {}),
    });
    pages.push(...response.pages);
    cursor = response.hasMore ? (response.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return pages;
}
