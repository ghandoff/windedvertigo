/**
 * @windedvertigo/notion-adapter
 *
 * Thin seam over the v2-vs-v5 divergence in `@notionhq/client`.
 *
 * The only call that meaningfully differs between v2 and v5 is the
 * database query (v2: `client.databases.query`, v5:
 * `client.dataSources.query`). Page-level operations
 * (`pages.retrieve`, `pages.update`, block-children fetches) and the
 * `PageObjectResponse` property accessors (`getTitle`, `getText`, etc.)
 * stay direct — those are stable across major versions.
 *
 * Callers pass in their own `Client` instance so the adapter has zero
 * knowledge of how each app instantiates Notion (lazy init, env var
 * names, retry policy, etc.).
 */

// v5-impl uses fetch() (CF Workers compatible). Creaseworks migrated to
// CF Workers (Phase H.2) and upgraded to @notionhq/client@^5.x — v2
// used node:https.request which CF Workers cannot polyfill. v5-impl is
// also forward-compatible with vault (Phase H.3). v2-impl preserved for
// any Vercel-hosted apps that haven't yet migrated.
export { queryDataSource, queryAllPages } from "./v5-impl";

export type {
  QueryDataSourceOptions,
  QueryDataSourcePage,
  NotionQueryFilter,
  NotionQuerySorts,
  PageObjectResponse,
} from "./types";
