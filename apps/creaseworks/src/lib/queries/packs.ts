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
} from "@/lib/security/column-selectors";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";
import { hasCoverUrlColumn, coverSelect, coverGroupBy, safeCols } from "@/lib/db-compat";

/**
 * Fetch all visible packs for the public catalogue page.
 * Joins packs_cache with packs_catalogue for pricing/visibility.
 */
export async function getVisiblePacks() {
  const cv = await coverSelect("pc");
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       ${cv}
       cat.price_cents,
       cat.currency,
       (SELECT COUNT(*) FROM pack_playdates pp WHERE pp.pack_id = pc.id) AS playdate_count,
       (SELECT COUNT(DISTINCT rc.created_by)
        FROM pack_playdates pp2
        JOIN runs_cache rc ON rc.playdate_notion_id = (
          SELECT plc.notion_id FROM playdates_cache plc WHERE plc.id = pp2.playdate_id
        )
        WHERE pp2.pack_id = pc.id
       )::int AS family_count
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
  const cv = await coverSelect("pc");
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       ${cv}
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
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
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
  const safe = await safeCols(PLAYDATE_ENTITLED_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
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
  const safe = await safeCols(PLAYDATE_COLLECTIVE_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
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
  const cv = await coverSelect("pc");
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       ${cv}
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
  const cv = await coverSelect("pc");
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       ${cv}
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
  const hasCover = await hasCoverUrlColumn();
  const coverCol = hasCover ? "cover_url," : "NULL AS cover_url,";
  const result = await sql.query(
    `SELECT id, slug, title, description, ${coverCol} status
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
  const cv = await coverSelect("pc");
  const result = await sql.query(
    `SELECT
       pc.id,
       pc.slug,
       pc.title,
       pc.description,
       ${cv}
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
 * Fetch up to 3 recommended unowned packs for a user.
 * Ranks by overlap with the user's tried arc_emphasis tags —
 * packs whose playdates cover arcs the user already enjoys
 * are scored higher. Falls back to playdate_count if no progress.
 */
export async function getRecommendedPacks(
  orgId: string | null,
  userId: string,
  limit = 3,
) {
  const cv = await coverSelect("pc");
  const cg = await coverGroupBy("pc");

  // If no org, recommend visible packs by size
  if (!orgId) {
    const result = await sql.query(
      `SELECT
         pc.id, pc.slug, pc.title, pc.description, ${cv}
         cat.price_cents, cat.currency,
         COUNT(DISTINCT pp.playdate_id)::int AS playdate_count
       FROM packs_cache pc
       JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
       LEFT JOIN pack_playdates pp ON pp.pack_id = pc.id
       WHERE cat.visible = true AND pc.status = 'ready' AND pc.slug IS NOT NULL
       GROUP BY pc.id, pc.slug, pc.title, pc.description${cg}, cat.price_cents, cat.currency
       ORDER BY playdate_count DESC
       LIMIT $1`,
      [limit],
    );
    return result.rows as Array<{
      id: string;
      slug: string;
      title: string;
      description: string | null;
      cover_url: string | null;
      price_cents: number | null;
      currency: string | null;
      playdate_count: number;
      arc_overlap: number;
    }>;
  }

  const result = await sql.query(
    `WITH user_arcs AS (
       SELECT DISTINCT jsonb_array_elements_text(p.arc_emphasis) AS arc
       FROM playdate_progress prg
       JOIN playdates_cache p ON p.id = prg.playdate_id
       WHERE prg.user_id = $2 AND prg.progress_tier IS NOT NULL
     ),
     pack_scores AS (
       SELECT
         pc.id, pc.slug, pc.title, pc.description, ${cv}
         cat.price_cents, cat.currency,
         COUNT(DISTINCT pp.playdate_id)::int AS playdate_count,
         COUNT(DISTINCT ua.arc)::int AS arc_overlap
       FROM packs_cache pc
       JOIN packs_catalogue cat ON cat.pack_cache_id = pc.id
       LEFT JOIN pack_playdates pp ON pp.pack_id = pc.id
       LEFT JOIN playdates_cache plc ON plc.id = pp.playdate_id AND plc.status = 'ready'
       LEFT JOIN LATERAL (
         SELECT jsonb_array_elements_text(plc.arc_emphasis) AS arc
       ) pack_arcs ON true
       LEFT JOIN user_arcs ua ON ua.arc = pack_arcs.arc
       WHERE cat.visible = true
         AND pc.status = 'ready'
         AND pc.slug IS NOT NULL
         AND pc.id NOT IN (
           SELECT e.pack_cache_id FROM entitlements e
           WHERE e.org_id = $1
             AND e.revoked_at IS NULL
             AND (e.expires_at IS NULL OR e.expires_at > NOW())
         )
       GROUP BY pc.id, pc.slug, pc.title, pc.description${cg}, cat.price_cents, cat.currency
     )
     SELECT * FROM pack_scores
     ORDER BY arc_overlap DESC, playdate_count DESC
     LIMIT $3`,
    [orgId, userId, limit],
  );
  return result.rows as Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    cover_url: string | null;
    price_cents: number | null;
    currency: string | null;
    playdate_count: number;
    arc_overlap: number;
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
