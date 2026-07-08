import { Client } from '@notionhq/client';

export { Client };

const _notion = new Client({
  auth: process.env.NOTION_TOKEN,
  timeoutMs: 30000,
});

/**
 * Kill-switch for all Notion WRITES — Stage 1 of the Notion → Postgres
 * single-source-of-truth cutover (2026-07-08).
 *
 * Postgres is already the canonical store (Phase B write-first + Postgres-first
 * reads). This flag lets us stop the fire-and-forget Notion mirror in
 * production WITHOUT a deploy, and roll back instantly, before Stage 2 deletes
 * the Notion code entirely.
 *
 * Default ENABLED — only an explicit `NOTION_ENABLED=0` (or "false") turns
 * Notion writes off, so merging this change is a no-op until the secret is set
 * on the `wv-nordic` worker (`wrangler secret put NOTION_ENABLED`). Read at call
 * time, so flipping the secret takes effect on the next request — no deploy.
 *
 * Scope: gates WRITES only. Reads keep their Postgres-first-with-Notion-fallback
 * safety net during the soak; Stage 2 removes the fallback with the rest of the
 * Notion code.
 */
export function isNotionEnabled() {
  const flag = process.env.NOTION_ENABLED;
  return flag !== '0' && flag !== 'false';
}

// Resolved value returned by a write method when Notion is disabled: a benign
// no-op page-like object with no id. Callers (writePostgresFirst back-patch,
// Phase-A helpers) already guard on `page?.id`, so a null id skips cleanly.
const _NOTION_WRITE_SKIPPED = { id: null, _notionDisabled: true };

/**
 * Retry wrapper with exponential backoff + jitter.
 * Retries on:
 *   - 429  (rate limit)   — up to maxRetries times
 *   - 5xx  (server error) — up to maxRetries times
 *   - notionhq_client_request_timeout — up to 1 time only.
 *     Timeouts are transient Notion API hiccups. We allow a single
 *     retry (with a flat 2s pause) rather than the full exponential
 *     chain, because each retry costs another 30s timeout window and
 *     we don't want to hold a CF Worker open for 90+ seconds per call.
 *
 * Notion rate limit: 3 requests/sec per integration token.
 */
export async function withRetry(fn, maxRetries = 3) {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const status = error?.status;
      const code   = error?.code;
      const isTimeout     = code === 'notionhq_client_request_timeout';
      const isRateLimit   = status === 429;
      const isServerError = status >= 500 && status < 600;
      const isRetryable   = isRateLimit || isServerError || isTimeout;

      if (!isRetryable || attempt === maxRetries) throw error;

      // Timeouts: single retry after a flat 2s pause — don't escalate.
      // Rate limits / 5xx: exponential backoff 1s→2s→4s (capped 10s) + jitter.
      const delay = isTimeout
        ? 2000
        : Math.min(1000 * Math.pow(2, attempt), 10000) + Math.random() * 500;

      // Timeouts only get one retry regardless of maxRetries.
      if (isTimeout && attempt >= 1) throw error;

      await new Promise(r => setTimeout(r, delay));
    }
  }
}

/**
 * v5 migration: the legacy Notion API endpoint `databases.query(database_id)`
 * was replaced by `dataSources.query(data_source_id)` in API version
 * 2025-09-03. A "database" can now contain multiple "data sources"; each
 * data source is what you query. Legacy single-source databases still have
 * one data source whose id must be resolved via `databases.retrieve`.
 *
 * This cache memoizes `database_id → data_source_id` lookups so we pay the
 * resolution cost once per process, not per query.
 */
const _dataSourceCache = new Map();

export async function resolveDataSourceId(id) {
  if (!id) return id;
  if (_dataSourceCache.has(id)) return _dataSourceCache.get(id);
  try {
    const db = await _notion.databases.retrieve({ database_id: id });
    // A legacy DB has exactly one entry in data_sources; multi-source DBs
    // would require callers to pick a specific one (none in this codebase).
    const resolved = db?.data_sources?.[0]?.id || id;
    _dataSourceCache.set(id, resolved);
    return resolved;
  } catch {
    // If retrieve fails (maybe the id is already a data_source_id, or the
    // caller lacks permission to inspect), fall back to passing the id
    // through unchanged. dataSources.query will surface a clearer error.
    _dataSourceCache.set(id, id);
    return id;
  }
}

/**
 * Wrapped Notion client with:
 *  - automatic retry on 429 / 5xx
 *  - a compatibility shim that routes `databases.query({ database_id })`
 *    through v5's `dataSources.query({ data_source_id })` with on-the-fly
 *    id resolution. Callers written against the v2 API keep working.
 *
 * Exported so any module in this repo can `import { notion } from './notion'`
 * instead of instantiating its own `new Client(...)`.
 */
export const notion = {
  dataSources: {
    query: async ({ data_source_id, ...rest }) => {
      const id = await resolveDataSourceId(data_source_id);
      return withRetry(() => _notion.dataSources.query({ data_source_id: id, ...rest }));
    },
  },
  databases: {
    /** @deprecated v5 compat shim — delegates to dataSources.query */
    query: async ({ database_id, ...rest }) => {
      const id = await resolveDataSourceId(database_id);
      return withRetry(() => _notion.dataSources.query({ data_source_id: id, ...rest }));
    },
    retrieve: (...args) => withRetry(() => _notion.databases.retrieve(...args)),
  },
  pages: {
    // Writes are gated by the NOTION_ENABLED kill-switch (Stage 1 cutover).
    // When disabled they resolve to a no-op instead of hitting Notion.
    create: (...args) =>
      isNotionEnabled()
        ? withRetry(() => _notion.pages.create(...args))
        : Promise.resolve(_NOTION_WRITE_SKIPPED),
    retrieve: (...args) => withRetry(() => _notion.pages.retrieve(...args)),
    update: (...args) =>
      isNotionEnabled()
        ? withRetry(() => _notion.pages.update(...args))
        : Promise.resolve(_NOTION_WRITE_SKIPPED),
  },
  comments: {
    list: (...args) => withRetry(() => _notion.comments.list(...args)),
    create: (...args) =>
      isNotionEnabled()
        ? withRetry(() => _notion.comments.create(...args))
        : Promise.resolve(_NOTION_WRITE_SKIPPED),
  },
};

