/**
 * Database compatibility helpers.
 *
 * Provides cached runtime checks for optional columns so that queries
 * degrade gracefully when a migration hasn't been applied yet.
 * Once the column exists, the cached flag stays true for the process
 * lifetime — zero ongoing cost.
 */

import { sql } from "@/lib/db";

/* ── cover_url column (migration 032 for packs/playdates, 034 for collections) ── */

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

/* ── collection cover_url column (migration 034) ─────────────────── */

let _hasCollectionCoverUrl: boolean | null = null;

/**
 * Check (once per process) whether collections has the cover_url column.
 * Migration 034 adds cover_url + cover_r2_key to collections.
 */
export async function hasCollectionCoverUrlColumn(): Promise<boolean> {
  if (_hasCollectionCoverUrl !== null) return _hasCollectionCoverUrl;
  try {
    const r = await sql.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'collections' AND column_name = 'cover_url'
       LIMIT 1`,
    );
    _hasCollectionCoverUrl = r.rows.length > 0;
  } catch {
    _hasCollectionCoverUrl = false;
  }
  return _hasCollectionCoverUrl;
}

/**
 * Returns `"alias.cover_url,"` when the collections cover column exists,
 * otherwise `"NULL AS cover_url,"`.
 */
export async function collectionCoverSelect(alias: string): Promise<string> {
  return (await hasCollectionCoverUrlColumn())
    ? `${alias}.cover_url,`
    : `NULL AS cover_url,`;
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
 * Filter cover_url and gallery_visible_fields out of a column-selector
 * array when the respective columns don't exist yet, keeping all other
 * columns intact.
 */
export async function safeCols(
  columns: readonly string[],
): Promise<string[]> {
  const hasCover = await hasCoverUrlColumn();
  const hasGallery = await hasGalleryVisibleFieldsColumn();
  return columns.filter((c) => {
    if (c === "cover_url" && !hasCover) return false;
    if (c === "gallery_visible_fields" && !hasGallery) return false;
    return true;
  });
}
