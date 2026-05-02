/**
 * v5-backed implementation of the Notion adapter surface.
 *
 * Targets `@notionhq/client@^5.x`. v5 uses fetch() instead of
 * node:https.request, making it compatible with Cloudflare Workers.
 *
 * The client.databases.query() interface is functionally identical
 * to v2 — only the transport layer changed. Using `client: any` here
 * avoids TypeScript type conflicts when apps still have v2 types in their
 * own node_modules (which npm workspaces can resolve separately).
 *
 * When creaseworks migrated to CF Workers (Phase H.2), this became the
 * default export. Vault will also use it once it migrates (Phase H.3).
 */

import type {
  QueryDataSourceOptions,
  QueryDataSourcePage,
} from "./types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryDataSource(
  client: any,
  options: QueryDataSourceOptions,
): Promise<QueryDataSourcePage> {
  const { databaseId, filter, sorts, pageSize, startCursor } = options;

  // Build params without undefined keys (same defensive pattern as v2-impl).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const params: Record<string, any> = {
    database_id: databaseId,
    page_size: pageSize ?? 100,
  };
  if (filter !== undefined) params.filter = filter;
  if (sorts !== undefined) params.sorts = sorts;
  if (startCursor !== undefined) params.start_cursor = startCursor;

  const response = await client.databases.query(params);

  return {
    pages: response.results,
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Paginates queryDataSource to completion. Identical API to v2-impl.
 */
export async function queryAllPages(
  client: any,
  options: Omit<QueryDataSourceOptions, "startCursor"> & { delayMs?: number },
): Promise<any[]> {
  const { delayMs, ...queryOptions } = options;
  const all: any[] = [];
  let cursor: string | undefined = undefined;

  do {
    if (delayMs && all.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    const page: QueryDataSourcePage = await queryDataSource(client, {
      ...queryOptions,
      ...(cursor !== undefined ? { startCursor: cursor } : {}),
    });
    all.push(...page.pages);
    cursor = page.hasMore ? (page.nextCursor ?? undefined) : undefined;
  } while (cursor);

  return all;
}
