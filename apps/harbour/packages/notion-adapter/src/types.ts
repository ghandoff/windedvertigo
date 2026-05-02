/**
 * Shared types for the Notion adapter.
 *
 * The adapter exposes a narrow surface that intentionally mirrors the
 * shape both v2 (`databases.query`) and v5 (`dataSources.query`) callers
 * need, so the implementation file is the only thing that has to change
 * when an app migrates from v2 to v5.
 *
 * Note: `QueryDataSourcePage.pages` is typed as `any[]` rather than
 * `PageObjectResponse[]` to avoid cross-version TypeScript conflicts.
 * v2 and v5 both have a `PageObjectResponse` type but with different
 * shapes (v5 adds `is_archived`, `is_locked`). Callers should cast to
 * their own version's `PageObjectResponse` type as needed.
 */
import type { QueryDatabaseParameters } from "@notionhq/client/build/src/api-endpoints";

// Re-export PageObjectResponse from the adapter's own @notionhq/client so
// callers that import this type get a consistent version. Callers on a
// different version should import PageObjectResponse directly from their
// local @notionhq/client instead.
export type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";

/**
 * Filter shape accepted by `databases.query` / `dataSources.query`.
 * Re-exported via the upstream type so callers can build filters with
 * full Notion type-checking without importing from `@notionhq/client`
 * directly.
 */
export type NotionQueryFilter = QueryDatabaseParameters["filter"];
export type NotionQuerySorts = QueryDatabaseParameters["sorts"];

export interface QueryDataSourceOptions {
  /** Notion database (v2) / data-source (v5) ID. */
  databaseId: string;
  /** Optional filter — same shape on v2 and v5. */
  filter?: NotionQueryFilter;
  /** Optional sorts — same shape on v2 and v5. */
  sorts?: NotionQuerySorts;
  /** Page size; defaults to 100 (Notion API max). */
  pageSize?: number;
  /** Pagination cursor for the next page. */
  startCursor?: string;
}

export interface QueryDataSourcePage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pages: any[];
  hasMore: boolean;
  nextCursor: string | null;
}
