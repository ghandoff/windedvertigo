/**
 * v2-backed implementation of the Notion adapter surface.
 *
 * Targets `@notionhq/client@^2.3.0`. v2 uses `client.databases.query()`
 * and the response shape is `QueryDatabaseResponse`.
 *
 * Creaseworks and vertigo-vault both pin v2 today (v2 uses
 * `node:https.request`, which CF Workers cannot polyfill — that's why
 * the eventual creaseworks→Workers migration will require swapping in
 * a v5 implementation here).
 */
import type { Client } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";
import type {
  QueryDataSourceOptions,
  QueryDataSourcePage,
} from "./types";

export async function queryDataSource(
  client: Client,
  options: QueryDataSourceOptions,
): Promise<QueryDataSourcePage> {
  const { databaseId, filter, sorts, pageSize, startCursor } = options;

  // The v2 client distinguishes `undefined` from "key absent" only via
  // `exactOptionalPropertyTypes`. Build the params object piecemeal so
  // we never set `filter: undefined` etc. when the caller didn't pass
  // one — keeps the wire payload identical to direct callers' today.
  const params: Parameters<Client["databases"]["query"]>[0] = {
    database_id: databaseId,
    page_size: pageSize ?? 100,
  };
  if (filter !== undefined) params.filter = filter;
  if (sorts !== undefined) params.sorts = sorts;
  if (startCursor !== undefined) params.start_cursor = startCursor;

  const response: QueryDatabaseResponse = await client.databases.query(params);

  return {
    pages: response.results as PageObjectResponse[],
    hasMore: response.has_more,
    nextCursor: response.next_cursor,
  };
}

/**
 * Convenience wrapper that paginates `queryDataSource` to completion.
 * Mirrors the `queryAllPages(databaseId)` pattern callers wrote inline
 * across creaseworks + vault.
 *
 * Note: this does not insert a delay between pages — callers that need
 * Notion rate-limit pacing (3 req/s) should pass a `delayMs` and we'll
 * sleep between paginated requests.
 */
export async function queryAllPages(
  client: Client,
  options: Omit<QueryDataSourceOptions, "startCursor"> & { delayMs?: number },
): Promise<PageObjectResponse[]> {
  const { delayMs, ...queryOptions } = options;
  const all: PageObjectResponse[] = [];
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
