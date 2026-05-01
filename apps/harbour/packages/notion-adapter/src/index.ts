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

// Today: only the v2 implementation is wired (creaseworks + vault both
// pin `@notionhq/client@^2.3.0`).
export { queryDataSource, queryAllPages } from "./v2-impl";

// TODO: import v5-impl when creaseworks migrates to CF Workers (Phase
// 5b of the macro stack-migration). v2 cannot run on Workers because
// it uses `node:https.request`; v5 uses `fetch` and works there. When
// that migration lands, swap the import above to `./v5-impl` (or
// branch on a build-time flag if both apps haven't migrated yet).
// export { queryDataSource, queryAllPages } from "./v5-impl";

export type {
  QueryDataSourceOptions,
  QueryDataSourcePage,
  NotionQueryFilter,
  NotionQuerySorts,
  PageObjectResponse,
} from "./types";
