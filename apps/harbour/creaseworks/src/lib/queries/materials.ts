/**
 * Material queries — used by the matcher picker and elsewhere.
 *
 * MVP 3 — matcher.
 */

import { sql } from "@/lib/db";
import { mapCreaseworksRows } from "./cover-row";

// Import + re-export the pure slug helper so existing server-side imports keep working.
import { materialSlug } from "@/lib/material-slug";
export { materialSlug };

/**
 * Fetch all materials excluding do-not-use, ordered by form then title.
 * Used to populate the matcher material picker.
 */
export async function getAllMaterials() {
  const result = await sql.query(
    `SELECT id, title, emoji, icon, form_primary, functions, context_tags
     FROM materials_cache
     WHERE do_not_use = false
     ORDER BY form_primary ASC, title ASC`,
  );
  return result.rows;
}

/**
 * Fetch a single material by its slugified title.
 * Returns null if not found or marked do-not-use.
 */
export async function getMaterialBySlug(slug: string) {
  const result = await sql.query(
    `SELECT id, title, emoji, icon, form_primary, functions, context_tags,
            connector_modes, examples_notes
     FROM materials_cache
     WHERE do_not_use = false`,
  );
  // match by slugified title since there's no slug column
  const row = result.rows.find(
    (r: { title: string }) => materialSlug(r.title) === slug,
  );
  return row ?? null;
}

/**
 * Fetch all playdates that use a specific material.
 */
export async function getPlaydatesForMaterial(materialId: string) {
  const result = await sql.query(
    `SELECT p.id, p.slug, p.title, p.headline, p.primary_function,
            p.arc_emphasis, p.context_tags, p.friction_dial,
            p.start_in_120s, p.tinkering_tier, p.cover_r2_key,
            p.gallery_visible_fields,
            (p.find_again_mode IS NOT NULL) AS has_find_again,
            COALESCE(rc.run_count, 0)::int AS run_count
     FROM playdates_cache p
     JOIN playdate_materials pm ON pm.playdate_id = p.id
     LEFT JOIN (
       SELECT playdate_notion_id, COUNT(*)::int AS run_count
       FROM runs_cache
       GROUP BY playdate_notion_id
     ) rc ON rc.playdate_notion_id = p.notion_id
     WHERE pm.material_id = $1
       AND p.status = 'ready'
     ORDER BY p.title ASC`,
    [materialId],
  );
  return mapCreaseworksRows(result.rows);
}
