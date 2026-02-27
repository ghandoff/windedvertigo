/**
 * Pack catalogue and pack-playdate queries.
 *
 * MVP 2 — entitlements, pack-only content, watermarking.
 */

import { sql } from "@/lib/db";
import {
  PLAYDATE_TEASER_COLUMNS,
  PLAYDATE_ENTITLED_COLUMNS,
  PLAYDATE_COLLECTIVE_COLUMNS,
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
       (SELECT COUNT(*) FROM pack_playdates pp WHERE pp.pack_id = pc.id) AS playdate_count
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
       (SELECT COUNT(*) FROM pack_playdates pp WHERE pp.pack_id = pc.id) AS playdate_count
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
 * Fetch teaser-tier playdates belonging to a pack.
 * Used on the pack detail page for non-entitled users.
 */
export async function getPackPlaydates(packCacheId: string) {
  const cols = PLAYDATE_TEASER_COLUMNS.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again
     FROM playdates_cache p
     JOIN pack_playdates pp ON pp.playdate_id = p.id
     WHERE pp.pack_id = $1
       AND p.status = 'ready'
     ORDER BY p.title ASC`,
    [packCacheId],
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows;
}

/**
 * Fetch entitled-tier playdates belonging to a pack.
 * Caller must verify entitlement before calling.
 */
export async function getPackPlaydatesEntitled(packCacheId: string) {
  const cols = PLAYDATE_ENTITLED_COLUMNS.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols}
     FROM playdates_cache p
     JOIN pack_playdates pp ON pp.playdate_id = p.id
     WHERE pp.pack_id = $1
       AND p.status = 'ready'
     ORDER BY p.title ASC`,
    [packCacheId],
  );
  assertNoLeakedFields(result.rows, "entitled");
  return result.rows;
}

/**
 * Fetch collective-tier playdates belonging to a pack.
 * Includes design rationale, developmental notes, author notes.
 * No status filter — collective can see drafts.
 * Caller must verify isInternal before calling.
 */
export async function getPackPlaydatesCollective(packCacheId: string) {
  const cols = PLAYDATE_COLLECTIVE_COLUMNS.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again
     FROM playdates_cache p
     JOIN pack_playdates pp ON pp.playdate_id = p.id
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
       (SELECT COUNT(*) FROM pack_playdates pp WHERE pp.pack_id = pc.id) AS playdate_count
     FROM packs_cache pc
     LEFT JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pc.slug IS NOT NULL AND pc.slug != ''
       AND pc.title IS NOT NULL AND pc.title != ''
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
       (SELECT COUNT(*) FROM pack_playdates pp WHERE pp.pack_id = pc.id) AS playdate_count
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
 * Fetch the first visible pack containing a given playdate.
 * Used for "view packs" links on sampler teaser pages.
 * Returns { slug, title } or null if the playdate isn't in any visible pack.
 */
export async function getFirstVisiblePackForPlaydate(
  playdateId: string,
): Promise<{ id: string; slug: string; title: string } | null> {
  const result = await sql.query(
    `SELECT pc.id, pc.slug, pc.title
     FROM packs_cache pc
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     JOIN pack_playdates pp ON pp.pack_id = pc.id
     WHERE pp.playdate_id = $1
       AND cat.visible = true
       AND pc.status = 'ready'
       AND pc.slug IS NOT NULL
     ORDER BY pc.title ASC
     LIMIT 1`,
    [playdateId],
  );
  return result.rows[0] ?? null;
}

/**
 * Batch-fetch pack info for a list of playdate IDs.
 * Returns a map of playdateId → { packId, packSlug, packTitle }.
 * Used by the sampler grid to show "🔒 Pack Name" badges.
 */
export async function batchGetPackInfoForPlaydates(
  playdateIds: string[],
): Promise<Map<string, { packId: string; packSlug: string; packTitle: string }>> {
  if (playdateIds.length === 0) return new Map();
  const result = await sql.query(
    `SELECT DISTINCT ON (pp.playdate_id)
       pp.playdate_id,
       pc.id AS pack_id,
       pc.slug AS pack_slug,
       pc.title AS pack_title
     FROM pack_playdates pp
     JOIN packs_cache pc ON pc.id = pp.pack_id
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE pp.playdate_id = ANY($1)
       AND cat.visible = true
       AND pc.status = 'ready'
       AND pc.slug IS NOT NULL
     ORDER BY pp.playdate_id, pc.title ASC`,
    [playdateIds],
  );
  const map = new Map<string, { packId: string; packSlug: string; packTitle: string }>();
  for (const row of result.rows) {
    map.set(row.playdate_id, {
      packId: row.pack_id,
      packSlug: row.pack_slug,
      packTitle: row.pack_title,
    });
  }
  return map;
}

/**
 * Fetch visible packs that an org does NOT own.
 * Used for upsell sections on playbook/profile pages.
 */
export async function getUnownedPacks(orgId: string | null) {
  if (!orgId) {
    // No org = show all visible packs
    return getVisiblePacks();
  }
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       cat.price_cents,
       cat.currency,
       (SELECT COUNT(*) FROM pack_playdates pp WHERE pp.pack_id = pc.id) AS playdate_count
     FROM packs_cache pc
     JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
     WHERE cat.visible = true
       AND pc.status = 'ready'
       AND pc.slug IS NOT NULL
       AND pc.id NOT IN (
         SELECT e.pack_cache_id FROM entitlements e
         WHERE e.org_id = $1
           AND e.revoked_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > now())
       )
     ORDER BY pc.title ASC`,
    [orgId],
  );
  return result.rows;
}

/**
 * Admin: fetch all packs with their playdate ID arrays.
 * Used by the admin playdate browser for pack-based filtering.
 */
export async function getAllPacksWithPlaydateIds() {
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       ARRAY_AGG(pp.playdate_id) AS playdate_ids
     FROM packs_cache pc
     JOIN pack_playdates pp ON pp.pack_id = pc.id
     WHERE pc.slug IS NOT NULL AND pc.slug != ''
       AND pc.title IS NOT NULL AND pc.title != ''
     GROUP BY pc.id, pc.slug, pc.title
     ORDER BY pc.title ASC`,
  );
  return result.rows as Array<{
    id: string;
    slug: string;
    title: string;
    playdate_ids: string[];
  }>;
}

/**
 * Check whether a playdate belongs to a specific pack.
 */
export async function isPlaydateInPack(
  playdateId: string,
  packCacheId: string,
): Promise<boolean> {
  const result = await sql.query(
    `SELECT 1 FROM pack_playdates
     WHERE playdate_id = $1 AND pack_id = $2
     LIMIT 1`,
    [playdateId, packCacheId],
  );
  return result.rows.length > 0;
}
