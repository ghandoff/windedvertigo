/**
 * Database compatibility helpers.
 *
 * Provides cached runtime checks for optional columns so that queries
 * degrade gracefully when a migration hasn't been applied yet.
 * Once the column exists, the cached flag stays true for the process
 * lifetime — zero ongoing cost.
 */

import { sql } from "@/lib/db";

/* ── cover_url column (migration 032) ────────────────────────────── */

let _hasCoverUrl: boolean | null = null;

/**
 * Check (once per process) whether packs_cache has the cover_url column.
 * Migration 032 adds cover_url + cover_r2_key to both packs_cache and
 * playdates_cache — checking one table is sufficient.
 */
export async function hasCoverUrlColumn(): Promise<boolean> {
  if (_hasCoverUrl !== null) return _hasCoverUrl;
  try {
    const r = await sql.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'packs_cache' AND column_name = 'cover_url'
       LIMIT 1`,
    );
    _hasCoverUrl = r.rows.length > 0;
  } catch {
    _hasCoverUrl = false;
  }
  return _hasCoverUrl;
}

/**
 * Returns `"alias.cover_url,"` when the column exists,
 * otherwise `"NULL AS cover_url,"` — safe to splice into SELECT lists.
 */
export async function coverSelect(alias: string): Promise<string> {
  return (await hasCoverUrlColumn())
    ? `${alias}.cover_url,`
    : `NULL AS cover_url,`;
}

/**
 * Returns `", alias.cover_url"` for GROUP BY clauses when the column
 * exists, otherwise an empty string.
 */
export async function coverGroupBy(alias: string): Promise<string> {
  return (await hasCoverUrlColumn()) ? `, ${alias}.cover_url` : "";
}

/**
 * Filter cover_url out of a column-selector array when the column
 * doesn't exist yet, keeping all other columns intact.
 */
export async function safeCols(
  columns: readonly string[],
): Promise<string[]> {
  if (await hasCoverUrlColumn()) return [...columns];
  return columns.filter((c) => c !== "cover_url");
}
