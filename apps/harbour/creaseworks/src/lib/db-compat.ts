/**
 * Database compatibility helpers.
 *
 * Provides cached runtime checks for optional columns so that queries
 * degrade gracefully when a migration hasn't been applied yet.
 * Once the column exists, the cached flag stays true for the process
 * lifetime — zero ongoing cost.
 */

import { sql } from "@/lib/db";

/* ── cover_r2_key column (migration 032 for packs/playdates, 034 for collections) ──
 *
 * Phase 7.1: queries now SELECT cover_r2_key (the storage key), not cover_url.
 * The public URL is computed at read time via mapCreaseworksRow() in
 * lib/queries/cover-row.ts so future R2 bucket migrations only require an
 * env-var update. Helper names below are unchanged for call-site compatibility.
 */

let _hasCoverColumn: boolean | null = null;

/**
 * Check (once per process) whether packs_cache has the cover_r2_key column.
 * Migration 032 adds cover_url + cover_r2_key to both packs_cache and
 * playdates_cache — checking one table is sufficient.
 */
export async function hasCoverUrlColumn(): Promise<boolean> {
  if (_hasCoverColumn !== null) return _hasCoverColumn;
  try {
    const r = await sql.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'packs_cache' AND column_name = 'cover_r2_key'
       LIMIT 1`,
    );
    _hasCoverColumn = r.rows.length > 0;
  } catch {
    _hasCoverColumn = false;
  }
  return _hasCoverColumn;
}

/* ── collection cover_r2_key column (migration 034) ─────────────────── */

let _hasCollectionCoverColumn: boolean | null = null;

/**
 * Check (once per process) whether collections has the cover_r2_key column.
 * Migration 034 adds cover_url + cover_r2_key to collections.
 */
export async function hasCollectionCoverUrlColumn(): Promise<boolean> {
  if (_hasCollectionCoverColumn !== null) return _hasCollectionCoverColumn;
  try {
    const r = await sql.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'collections' AND column_name = 'cover_r2_key'
       LIMIT 1`,
    );
    _hasCollectionCoverColumn = r.rows.length > 0;
  } catch {
    _hasCollectionCoverColumn = false;
  }
  return _hasCollectionCoverColumn;
}

/**
 * Returns `"alias.cover_r2_key,"` when the collections cover column exists,
 * otherwise `"NULL AS cover_r2_key,"`. Wrap query results with
 * mapCreaseworksRow() to attach the computed cover_url.
 */
export async function collectionCoverSelect(alias: string): Promise<string> {
  return (await hasCollectionCoverUrlColumn())
    ? `${alias}.cover_r2_key,`
    : `NULL AS cover_r2_key,`;
}

/**
 * Returns `"alias.cover_r2_key,"` when the column exists, otherwise
 * `"NULL AS cover_r2_key,"` — safe to splice into SELECT lists. Wrap
 * query results with mapCreaseworksRow() to attach the computed cover_url.
 */
export async function coverSelect(alias: string): Promise<string> {
  return (await hasCoverUrlColumn())
    ? `${alias}.cover_r2_key,`
    : `NULL AS cover_r2_key,`;
}

/**
 * Returns `", alias.cover_r2_key"` for GROUP BY clauses when the column
 * exists, otherwise an empty string.
 */
export async function coverGroupBy(alias: string): Promise<string> {
  return (await hasCoverUrlColumn()) ? `, ${alias}.cover_r2_key` : "";
}

/* ── gallery_visible_fields column (migration 035) ─────────────── */

let _hasGalleryVisibleFields: boolean | null = null;

/**
 * Check (once per process) whether playdates_cache has the
 * gallery_visible_fields column (migration 035).
 */
export async function hasGalleryVisibleFieldsColumn(): Promise<boolean> {
  if (_hasGalleryVisibleFields !== null) return _hasGalleryVisibleFields;
  try {
    const r = await sql.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'playdates_cache' AND column_name = 'gallery_visible_fields'
       LIMIT 1`,
    );
    _hasGalleryVisibleFields = r.rows.length > 0;
  } catch {
    _hasGalleryVisibleFields = false;
  }
  return _hasGalleryVisibleFields;
}

/**
 * Filter cover_r2_key and gallery_visible_fields out of a column-selector
 * array when the respective columns don't exist yet, keeping all other
 * columns intact.
 */
export async function safeCols(
  columns: readonly string[],
): Promise<string[]> {
  const hasCover = await hasCoverUrlColumn();
  const hasGallery = await hasGalleryVisibleFieldsColumn();
  return columns.filter((c) => {
    if (c === "cover_r2_key" && !hasCover) return false;
    if (c === "gallery_visible_fields" && !hasGallery) return false;
    return true;
  });
}
