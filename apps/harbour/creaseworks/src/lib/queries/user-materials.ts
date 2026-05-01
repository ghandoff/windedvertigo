/**
 * User materials inventory — "my workshop".
 *
 * Persistent collection of materials a user has at home.
 * Pre-fills the matcher and enables material mastery tracking.
 */

import { sql } from "@/lib/db";

export interface UserMaterial {
  id: string;
  materialId: string;
  title: string;
  formPrimary: string | null;
  functions: string[];
  icon: string | null;
  emoji: string | null;
  addedAt: string;
  notes: string | null;
}

/**
 * Get all materials in a user's inventory, joined with material details.
 */
export async function getUserMaterials(userId: string): Promise<UserMaterial[]> {
  const r = await sql.query(
    `SELECT
       um.id,
       um.material_id,
       mc.title,
       mc.form_primary,
       mc.functions,
       mc.icon,
       mc.emoji,
       um.added_at,
       um.notes
     FROM user_materials um
     JOIN materials_cache mc ON mc.id = um.material_id
     WHERE um.user_id = $1
     ORDER BY mc.form_primary, mc.title`,
    [userId],
  );
  return r.rows.map((row) => ({
    id: row.id,
    materialId: row.material_id,
    title: row.title,
    formPrimary: row.form_primary,
    functions: row.functions ?? [],
    icon: row.icon,
    emoji: row.emoji,
    addedAt: row.added_at,
    notes: row.notes,
  }));
}

/**
 * Get material IDs in a user's inventory (for pre-filling the matcher).
 */
export async function getUserMaterialIds(userId: string): Promise<string[]> {
  const r = await sql.query(
    "SELECT material_id FROM user_materials WHERE user_id = $1",
    [userId],
  );
  return r.rows.map((row) => row.material_id);
}

/**
 * Add a material to the user's inventory. Idempotent (ON CONFLICT DO NOTHING).
 */
export async function addUserMaterial(
  userId: string,
  materialId: string,
  notes?: string,
): Promise<void> {
  await sql.query(
    `INSERT INTO user_materials (user_id, material_id, notes)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, material_id) DO NOTHING`,
    [userId, materialId, notes ?? null],
  );
}

/**
 * Remove a material from the user's inventory.
 */
export async function removeUserMaterial(
  userId: string,
  materialId: string,
): Promise<void> {
  await sql.query(
    "DELETE FROM user_materials WHERE user_id = $1 AND material_id = $2",
    [userId, materialId],
  );
}

/**
 * Toggle a material in/out of inventory. Returns true if added, false if removed.
 */
export async function toggleUserMaterial(
  userId: string,
  materialId: string,
): Promise<boolean> {
  const existing = await sql.query(
    "SELECT id FROM user_materials WHERE user_id = $1 AND material_id = $2 LIMIT 1",
    [userId, materialId],
  );
  if (existing.rows.length > 0) {
    await removeUserMaterial(userId, materialId);
    return false;
  }
  await addUserMaterial(userId, materialId);
  return true;
}

/**
 * Count how many playdates a user's inventory covers.
 */
export async function getInventoryCoverage(userId: string): Promise<{
  totalPlaydates: number;
  coveredPlaydates: number;
}> {
  const r = await sql.query(
    `WITH user_mats AS (
       SELECT material_id FROM user_materials WHERE user_id = $1
     ),
     playdate_coverage AS (
       SELECT
         pm.pattern_id,
         COUNT(pm.material_id) AS required,
         COUNT(um.material_id) AS owned
       FROM pattern_materials pm
       LEFT JOIN user_mats um ON um.material_id = pm.material_id
       GROUP BY pm.pattern_id
     )
     SELECT
       COUNT(*) AS total,
       COUNT(*) FILTER (WHERE owned >= required) AS covered
     FROM playdate_coverage`,
    [userId],
  );
  return {
    totalPlaydates: parseInt(r.rows[0]?.total ?? "0", 10),
    coveredPlaydates: parseInt(r.rows[0]?.covered ?? "0", 10),
  };
}
