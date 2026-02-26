import { queryAllPages } from "@/lib/notion";
import type { NotionPage } from "./extract";

/**
 * Generic orchestrator for Notion → Postgres cache-table sync.
 *
 * Every handler follows the same four steps:
 *   1. Fetch all pages from a Notion database
 *   2. Parse each page and upsert into the cache table
 *   3. Remove (hard- or soft-delete) records that no longer exist in Notion
 *   4. Resolve foreign-key relations (optional)
 *
 * This utility encodes the loop once; callers provide the
 * handler-specific SQL via callbacks.
 */

export interface SyncConfig<T extends { notionId: string }> {
  /** Notion database ID (use NOTION_DBS.xxx). */
  databaseId: string;
  /** Human-readable label for log lines, e.g. "materials". */
  label: string;
  /** Parse a single Notion page into a typed row. */
  parsePage: (page: NotionPage) => T;
  /** Upsert one parsed row into the cache table. */
  upsertRow: (row: T) => Promise<void>;
  /** Remove stale rows whose notion_id isn't in the given array. */
  cleanupStale: (activeNotionIds: string[]) => Promise<void>;
  /**
   * Optional: resolve foreign-key relations after all rows are upserted.
   * Receives the full page list so each handler can re-parse relation IDs.
   */
  resolveRelations?: (pages: NotionPage[]) => Promise<void>;
}

export async function syncCacheTable<T extends { notionId: string }>(
  config: SyncConfig<T>,
): Promise<number> {
  const { databaseId, label, parsePage, upsertRow, cleanupStale, resolveRelations } = config;

  console.log(`[sync] fetching ${label} from Notion...`);
  const pages = await queryAllPages(databaseId);
  console.log(`[sync] found ${pages.length} ${label}`);

  // Step 1+2: parse & upsert
  const notionIds: string[] = [];
  for (const page of pages) {
    const row = parsePage(page);
    notionIds.push(row.notionId);
    await upsertRow(row);
  }

  // Step 3: clean up stale rows
  if (notionIds.length > 0) {
    await cleanupStale(notionIds);
  }

  // Step 4: resolve relations (if handler needs it)
  if (resolveRelations) {
    await resolveRelations(pages);
  }

  console.log(`[sync] ${label} sync complete: ${pages.length} upserted`);
  return pages.length;
}
