/**
 * Pack catalogue and pack-pattern queries.
 *
 * MVP 2 — entitlements, pack-only content, watermarking.
 */

import { sql } from "@/lib/db";
import {
  PATTERN_TEASER_COLUMNS,
  PATTERN_ENTITLED_COLUMNS,
  PATTERN_COLLECTIVE_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";

/**
 * Fetch all visible packs for the public catalogue page.
 * Joins packs_cache with packs_catalogue for pricing/visibility.
 */
export async function getVisiblePacks() {
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       cat.price_cents,
       cat.currency,
       (SELECT COUNT(*) FROM pack_patterns pp WHERE pp.pack_id = pc.id) AS pattern_count
     FROM packs_cache pc
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE cat.visible = true
       AND pc.status = 'ready'
       AND pc.slug IS NOT NULL
     ORDER BY pc.title ASC`,
  );
  return result.rows;
}

/**
 * Fetch a single pack by slug with catalogue data.
 */
export async function getPackBySlug(slug: string) {
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       pc.status,
       cat.id AS catalogue_id,
       cat.price_cents,
       cat.currency,
       cat.visible,
       (SELECT COUNT(*) FROM pack_patterns pp WHERE pp.pack_id = pc.id) AS pattern_count
     FROM packs_cache pc
     LEFT JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pc.slug = $1
       AND pc.status = 'ready'
     LIMIT 1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

/**
 * Fetch teaser-tier patterns belonging to a pack.
 * Used on the pack detail page for non-entitled users.
 */
export async function getPackPatterns(packCacheId: string) {
  const cols = PATTERN_TEASER_COLUMNS.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again
     FROM patterns_cache p
     JOIN pack_patterns pp ON pp.pattern_id = p.id
     WHERE pp.pack_id = $1
       AND p.status = 'ready'
     ORDER BY p.title ASC`,
    [packCacheId],
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows;
}

/**
 * Fetch entitled-tier patterns belonging to a pack.
 * Caller must verify entitlement before calling.
 */
export async function getPackPatternsEntitled(packCacheId: string) {
  const cols = PATTERN_ENTITLED_COLUMNS.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols}
     FROM patterns_cache p
     JOIN pack_patterns pp ON pp.pattern_id = p.id
     WHERE pp.pack_id = $1
       AND p.status = 'ready'
     ORDER BY p.title ASC`,
    [packCacheId],
  );
  assertNoLeakedFields(result.rows, "entitled");
  return result.rows;
}

/**
 * Fetch collective-tier patterns belonging to a pack.
 * Includes design rationale, developmental notes, author notes.
 * No status filter — collective can see drafts.
 * Caller must verify isInternal before calling.
 */
export async function getPackPatternsCollective(packCacheId: string) {
  const cols = PATTERN_COLLECTIVE_COLUMNS.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again
     FROM patterns_cache p
     JOIN pack_patterns pp ON pp.pattern_id = p.id
     WHERE pp.pack_id = $1
     ORDER BY p.title ASC`,
    [packCacheId],
  );
  assertNoLeakedFields(result.rows, "collective");
  return result.rows;
}

/**
 * Collective: fetch all packs regardless of visibility or status.
 * Includes non-visible and draft packs.
 * Caller must verify isInternal before calling.
 */
export async function getAllPacks() {
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       pc.status,
       cat.price_cents,
       cat.currency,
       cat.visible,
       (SELECT COUNT(*) FROM pack_patterns pp WHERE pp.pack_id = pc.id) AS pattern_count
     FROM packs_cache pc
     LEFT JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pc.slug IS NOT NULL
     ORDER BY pc.title ASC`,
  );
  return result.rows;
}

/**
 * Collective: fetch a single pack by slug (no status filter).
 * Caller must verify isInternal before calling.
 */
export async function getPackBySlugCollective(slug: string) {
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       pc.status,
       cat.id AS catalogue_id,
       cat.price_cents,
       cat.currency,
       cat.visible,
       (SELECT COUNT(*) FROM pack_patterns pp WHERE pp.pack_id = pc.id) AS pattern_count
     FROM packs_cache pc
     LEFT JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pc.slug = $1
     LIMIT 1`,
    [slug],
  );
  return result.rows[0] ?? null;
}

/**
 * Admin: fetch all packs with status='ready' (ignores visibility).
 */
export async function getAllReadyPacks() {
  const result = await sql.query(
    `SELECT id, slug, title, description, status
     FROM packs_cache
     WHERE status = 'ready'
     ORDER BY title ASC`,
  );
  return result.rows;
}

/**
 * Fetch the first visible pack containing a given pattern.
 * Used for "view packs" links on sampler teaser pages.
 * Returns { slug, title } or null if the pattern isn't in any visible pack.
 */
export async function getFirstVisiblePackForPattern(
  patternId: string,
): Promise<{ slug: string; title: string } | null> {
  const result = await sql.query(
    `SELECT pc.slug, pc.title
     FROM packs_cache pc
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     JOIN pack_patterns pp ON pp.pack_id = pc.id
     WHERE pp.pattern_id = $1
       AND cat.visible = true
       AND pc.status = 'ready'
       AND pc.slug IS NOT NULL
     ORDER BY pc.title ASC
     LIMIT 1`,
    [patternId],
  );
  return result.rows[0] ?? null;
}

/**
 * Check whether a pattern belongs to a specific pack.
 */
export async function isPatternInPack(
  patternId: string,
  packCacheId: string,
): Promise<boolean> {
  const result = await sql.query(
    `SELECT 1 FROM pack_patterns
     WHERE pattern_id = $1 AND pack_id = $2
     LIMIT 1`,
    [patternId, packCacheId],
  );
  return result.rows.length > 0;
}
