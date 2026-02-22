/**
 * Material queries — used by the matcher picker and elsewhere.
 *
 * MVP 3 — matcher.
 */

import { sql } from "@/lib/db";

/**
 * Fetch all materials excluding do-not-use, ordered by form then title.
 * Used to populate the matcher material picker.
 */
export async function getAllMaterials() {
  const result = await sql.query(
    `SELECT id, title, form_primary, functions, context_tags
     FROM materials_cache
     WHERE do_not_use = false
     ORDER BY form_primary ASC, title ASC`,
  );
  return result.rows;
}
