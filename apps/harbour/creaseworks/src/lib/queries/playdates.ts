import { sql } from "@/lib/db";
import {
  PLAYDATE_TEASER_COLUMNS,
  PLAYDATE_ENTITLED_COLUMNS,
  PLAYDATE_COLLECTIVE_COLUMNS,
  columnsToSql,
} from "@/lib/security/column-selectors";
import { assertNoLeakedFields } from "@/lib/security/assert-no-leaked-fields";
import { safeCols } from "@/lib/db-compat";
import { mapCreaseworksRow, mapCreaseworksRows } from "./cover-row";

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
  return mapCreaseworksRows(result.rows);
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
  return mapCreaseworksRows(result.rows);
}

/**
 * Fetch all published playdates (sampler + pack-only) at teaser tier.
 * Used on /browse for non-internal users who should see the full public portfolio.
 */
export async function getPublishedPlaydates() {
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
       AND p.release_channel IN ('sampler', 'pack-only')
     ORDER BY p.title ASC`,
  );
  assertNoLeakedFields(result.rows, "teaser");
  return mapCreaseworksRows(result.rows);
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
  return result.rows[0] ? mapCreaseworksRow(result.rows[0]) : null;
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
  return result.rows[0] ? mapCreaseworksRow(result.rows[0]) : null;
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
  return result.rows[0] ? mapCreaseworksRow(result.rows[0]) : null;
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
  return result.rows[0] ? mapCreaseworksRow(result.rows[0]) : null;
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
  return mapCreaseworksRows(result.rows);
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
  return mapCreaseworksRows(result.rows);
}

// ── admin queries ──────────────────────────────────────────────────────

/**
 * Admin: fetch all ready playdates with content completeness indicators.
 *
 * Returns teaser-tier fields plus boolean flags for content presence
 * (has_find, has_fold, has_unfold, has_body, has_illustration) and
 * material_count. Keeps the payload small — full content is loaded
 * on demand via getAdminPlaydateDetail().
 */
export async function getAdminPlaydates() {
  const result = await sql.query(
    `SELECT
       p.id, p.slug, p.title, p.headline,
       p.release_channel, p.status, p.primary_function,
       p.arc_emphasis, p.context_tags, p.friction_dial,
       p.start_in_120s, p.tinkering_tier, p.cover_r2_key,
       p.age_range, p.energy_level, p.campaign_tags,
       p.notion_id, p.synced_at,
       (p.find IS NOT NULL AND p.find != '')::bool AS has_find,
       (p.fold IS NOT NULL AND p.fold != '')::bool AS has_fold,
       (p.unfold IS NOT NULL AND p.unfold != '')::bool AS has_unfold,
       (p.body_html IS NOT NULL AND p.body_html != '')::bool AS has_body,
       (p.illustration_url IS NOT NULL AND p.illustration_url != '')::bool AS has_illustration,
       (p.find_again_mode IS NOT NULL) AS has_find_again,
       COALESCE(rc.run_count, 0)::int AS run_count,
       COALESCE(mc.material_count, 0)::int AS material_count
     FROM playdates_cache p
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     LEFT JOIN (
       SELECT pm.playdate_id, COUNT(*)::int AS material_count
       FROM playdate_materials pm
       JOIN materials_cache m ON m.id = pm.material_id AND m.do_not_use = false
       GROUP BY pm.playdate_id
     ) mc ON mc.playdate_id = p.id
     WHERE p.status = 'ready'
     ORDER BY p.title ASC`,
  );
  return mapCreaseworksRows(result.rows);
}

/**
 * Admin: fetch full detail for a single playdate (on-demand preview).
 *
 * Returns all content fields including find/fold/unfold HTML, body_html,
 * materials list, and collective-tier metadata (design rationale, etc.).
 * No column selector — admin bypasses the anti-leak tier.
 */
export async function getAdminPlaydateDetail(id: string) {
  const [playdateResult, materialsResult] = await Promise.all([
    sql.query(
      `SELECT
         id, slug, title, headline, headline_html,
         release_channel, status, primary_function,
         arc_emphasis, context_tags, friction_dial,
         start_in_120s, tinkering_tier, cover_r2_key,
         age_range, energy_level, campaign_tags,
         find, find_html, fold, fold_html, unfold, unfold_html,
         find_again_mode, find_again_prompt, find_again_prompt_html,
         slots_optional, slots_notes,
         substitutions_notes, substitutions_notes_html,
         body_html, illustration_url,
         design_rationale, developmental_notes, author_notes,
         notion_id, notion_last_edited, synced_at
       FROM playdates_cache
       WHERE id = $1
       LIMIT 1`,
      [id],
    ),
    sql.query(
      `SELECT m.id, m.title, m.form_primary, m.functions, m.context_tags,
              m.emoji
       FROM materials_cache m
       JOIN playdate_materials pm ON pm.material_id = m.id
       WHERE pm.playdate_id = $1
         AND m.do_not_use = false
       ORDER BY m.title ASC`,
      [id],
    ),
  ]);

  if (!playdateResult.rows[0]) return null;
  return { ...mapCreaseworksRow(playdateResult.rows[0]), materials: materialsResult.rows };
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

export interface PlaydateMaterialTeaser {
  id: string;
  title: string;
  form_primary: string | null;
  functions: string[] | null;
  emoji: string | null;
  icon: string | null;
}

/**
 * Batch-fetch teaser materials for multiple playdates in a single query.
 * Returns a Map keyed by playdate UUID.
 */
export async function batchGetMaterialsForPlaydates(
  playdateIds: string[],
): Promise<Map<string, PlaydateMaterialTeaser[]>> {
  if (playdateIds.length === 0) return new Map();

  const result = await sql.query(
    `SELECT pm.playdate_id, m.id, m.title, m.form_primary, m.functions,
            m.emoji, m.icon
     FROM materials_cache m
     JOIN playdate_materials pm ON pm.material_id = m.id
     WHERE pm.playdate_id = ANY($1)
       AND m.do_not_use = false
     ORDER BY m.title ASC`,
    [playdateIds],
  );

  const map = new Map<string, PlaydateMaterialTeaser[]>();
  for (const row of result.rows) {
    const list = map.get(row.playdate_id) ?? [];
    list.push({
      id: row.id,
      title: row.title,
      form_primary: row.form_primary,
      functions: row.functions,
      emoji: row.emoji,
      icon: row.icon,
    });
    map.set(row.playdate_id, list);
  }
  return map;
}
