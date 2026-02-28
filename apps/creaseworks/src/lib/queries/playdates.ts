import { sql } from "@/lib/db";
import {
  PLAYDATE_TEASER_COLUMNS,
  PLAYDATE_ENTITLED_COLUMNS,
  PLAYDATE_COLLECTIVE_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";
import { safeCols } from "@/lib/db-compat";

/**
 * Fetch all public-ready playdates with teaser-tier columns only.
 * Used on the /sampler page grid.
 */
export async function getTeaserPlaydates() {
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again,
       COALESCE(rc.run_count, 0)::int AS run_count
     FROM playdates_cache p
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     WHERE p.status = 'ready'
       AND p.release_channel = 'sampler'
     ORDER BY p.title ASC`,
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows;
}

/**
 * Fetch all ready playdates with teaser-tier columns (no release_channel filter).
 * Used on /sampler for internal users who should see everything.
 */
export async function getAllReadyPlaydates() {
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again,
       COALESCE(rc.run_count, 0)::int AS run_count
     FROM playdates_cache p
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     WHERE p.status = 'ready'
     ORDER BY p.title ASC`,
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows;
}

/**
 * Fetch a single playdate by slug at teaser tier.
 */
export async function getTeaserPlaydateBySlug(slug: string) {
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = columnsToSql(safe);
  const result = await sql.query(
    `SELECT ${cols},
       (find_again_mode IS NOT NULL) AS has_find_again
     FROM playdates_cache
     WHERE slug = $1
       AND status = 'ready'
       AND release_channel = 'sampler'
     LIMIT 1`,
    [slug],
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows[0] ?? null;
}

/**
 * Fetch a single playdate by slug at entitled tier.
 * Caller must verify entitlement before calling.
 */
export async function getEntitledPlaydateBySlug(slug: string) {
  const cols = columnsToSql(PLAYDATE_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols}
     FROM playdates_cache
     WHERE slug = $1
       AND status = 'ready'
     LIMIT 1`,
    [slug],
  );
  assertNoLeakedFields(result.rows, "entitled");
  return result.rows[0] ?? null;
}

/**
 * Fetch a single playdate by UUID at entitled tier.
 * Used by the PDF generation route (lookup by id instead of slug).
 * Caller must verify entitlement before calling.
 */
export async function getEntitledPlaydateById(id: string) {
  const cols = columnsToSql(PLAYDATE_ENTITLED_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols}
     FROM playdates_cache
     WHERE id = $1
       AND status = 'ready'
     LIMIT 1`,
    [id],
  );
  assertNoLeakedFields(result.rows, "entitled");
  return result.rows[0] ?? null;
}

/**
 * Fetch a single playdate by slug at collective tier.
 * Includes design rationale, developmental notes, and author notes.
 * No status filter — collective can see drafts.
 * Caller must verify isInternal before calling.
 */
export async function getCollectivePlaydateBySlug(slug: string) {
  const cols = columnsToSql(PLAYDATE_COLLECTIVE_COLUMNS);
  const result = await sql.query(
    `SELECT ${cols}
     FROM playdates_cache
     WHERE slug = $1
     LIMIT 1`,
    [slug],
  );
  assertNoLeakedFields(result.rows, "collective");
  return result.rows[0] ?? null;
}

/**
 * Fetch ready playdates matching a campaign tag.
 * Used on /campaign/[slug] landing pages (scavenger hunts, promos).
 */
export async function getCampaignPlaydates(campaignSlug: string) {
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       (p.find_again_mode IS NOT NULL) AS has_find_again,
       COALESCE(rc.run_count, 0)::int AS run_count
     FROM playdates_cache p
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     WHERE p.status = 'ready'
       AND $1 = ANY(p.campaign_tags)
     ORDER BY p.title ASC`,
    [campaignSlug],
  );
  assertNoLeakedFields(result.rows, "teaser");
  return result.rows;
}

/**
 * Fetch ALL ready playdates that have any campaign tag.
 * Returns playdates with their campaign_tags array so the caller can group them.
 * Used on the /scavenger aggregation page.
 */
export async function getAllCampaignPlaydates() {
  const safe = await safeCols(PLAYDATE_TEASER_COLUMNS);
  const cols = safe.map((c) => `p.${c}`).join(", ");
  const result = await sql.query(
    `SELECT ${cols},
       p.campaign_tags,
       (p.find_again_mode IS NOT NULL) AS has_find_again,
       COALESCE(rc.run_count, 0)::int AS run_count
     FROM playdates_cache p
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     WHERE p.status = 'ready'
       AND p.campaign_tags IS NOT NULL
       AND array_length(p.campaign_tags, 1) > 0
     ORDER BY p.title ASC`,
  );
  // campaign_tags is an extra field needed for grouping — skip the leak check
  return result.rows;
}

/**
 * Fetch teaser-tier materials linked to a playdate (by playdate UUID).
 */
export async function getTeaserMaterialsForPlaydate(playdateId: string) {
  const result = await sql.query(
    `SELECT m.id, m.title, m.form_primary, m.functions, m.context_tags
     FROM materials_cache m
     JOIN playdate_materials pm ON pm.material_id = m.id
     WHERE pm.playdate_id = $1
       AND m.do_not_use = false
     ORDER BY m.title ASC`,
    [playdateId],
  );
  return result.rows;
}
