/**
 * @windedvertigo/notion — paginated query helper
 *
 * Uses dataSources.query (API version 2025-09-03+).
 * IDs are data source (collection) IDs, not page-based database IDs.
 */

import type { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import { withRetry } from "./retry";

export interface PaginatedResult {
  pages: PageObjectResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFilter = any;

export interface QueryDatabaseParams {
  database_id: string;
  filter?: AnyFilter;
  sorts?: Array<
    | { property: string; direction: "ascending" | "descending" }
    | { timestamp: "created_time" | "last_edited_time"; direction: "ascending" | "descending" }
  >;
  start_cursor?: string;
  page_size?: number;
  fetchAll?: boolean;
  label?: string;
}

/**
 * Query a Notion data source with automatic pagination.
 *
 * Accepts `database_id` for backward compatibility — this is actually
 * a data source (collection) ID used with the dataSources.query endpoint.
 *
 * By default fetches a single page of results (for API route use).
 * Set `fetchAll: true` to exhaust all pages (for build-time fetching).
 */
export async function queryDatabase(
  notion: Client,
  params: QueryDatabaseParams,
): Promise<PaginatedResult> {
  const {
    database_id,
    fetchAll = false,
    label = "queryDatabase",
    start_cursor,
    page_size = 100,
    filter,
    sorts,
  } = params;

  const allPages: PageObjectResponse[] = [];
  let cursor: string | undefined = start_cursor;
  let round = 0;
  let hasMore = false;

  do {
    round++;
    const response = await withRetry(
      () =>
        notion.dataSources.query({
          data_source_id: database_id,
          page_size,
          ...(filter ? { filter } : {}),
          ...(sorts ? { sorts } : {}),
          ...(cursor ? { start_cursor: cursor } : {}),
        }),
      `${label}:round${round}`,
    );

    for (const page of response.results) {
      if ("properties" in page) allPages.push(page as PageObjectResponse);
    }

    hasMore = response.has_more;
    cursor = response.has_more
      ? (response.next_cursor ?? undefined)
      : undefined;
  } while (fetchAll && cursor && round < 20);

  return {
    pages: allPages,
    nextCursor: cursor ?? null,
    hasMore,
  };
}
