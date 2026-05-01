/**
 * Material mastery — aggregate per-user material usage history.
 *
 * Tracks how many times a user has used each material and in which
 * functions. Powers the "function discovery" celebration and badges.
 */

import { sql } from "@/lib/db";

export interface MaterialUsageRecord {
  materialId: string;
  title: string;
  formPrimary: string | null;
  emoji: string | null;
  icon: string | null;
  /** total number of runs using this material */
  totalRuns: number;
  /** distinct functions this material was used as */
  functionsUsed: string[];
}

/**
 * Get a user's material usage history — which materials they've used,
 * how many times, and in which functions.
 */
export async function getUserMaterialMastery(
  userId: string,
): Promise<MaterialUsageRecord[]> {
  const result = await sql.query(
    `WITH usage AS (
       SELECT
         rm.material_id,
         COUNT(DISTINCT rc.id) AS total_runs,
         COALESCE(
           array_agg(DISTINCT (mua.value ->> 'function_used'))
           FILTER (WHERE mua.value ->> 'function_used' IS NOT NULL AND mua.value ->> 'function_used' != ''),
           '{}'
         ) AS functions_used
       FROM run_materials rm
       JOIN runs_cache rc ON rc.id = rm.run_id
       LEFT JOIN LATERAL jsonb_array_elements(rc.materials_used_as) AS mua(value)
         ON (mua.value ->> 'material_id') = rm.material_id::text
       WHERE rc.created_by = $1
       GROUP BY rm.material_id
     )
     SELECT
       u.material_id,
       m.title,
       m.form_primary,
       m.emoji,
       m.icon,
       u.total_runs,
       u.functions_used
     FROM usage u
     JOIN materials_cache m ON m.id = u.material_id
     ORDER BY u.total_runs DESC, m.title ASC`,
    [userId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    materialId: row.material_id as string,
    title: row.title as string,
    formPrimary: row.form_primary as string | null,
    emoji: row.emoji as string | null,
    icon: row.icon as string | null,
    totalRuns: parseInt(String(row.total_runs ?? "0"), 10),
    functionsUsed: (row.functions_used as string[]) ?? [],
  }));
}

/**
 * Check if a user is using a material in a new function for the first time.
 * Returns true if this is a new discovery (no previous record).
 */
export async function getNewFunctionDiscoveries(
  userId: string,
  materialId: string,
  functionUsed: string,
): Promise<boolean> {
  const result = await sql.query(
    `SELECT 1 FROM runs_cache rc
     JOIN run_materials rm ON rm.run_id = rc.id
     CROSS JOIN LATERAL jsonb_array_elements(rc.materials_used_as) AS mua(value)
     WHERE rc.created_by = $1
       AND rm.material_id = $2
       AND (mua.value ->> 'material_id') = $2::text
       AND (mua.value ->> 'function_used') = $3
     LIMIT 1`,
    [userId, materialId, functionUsed],
  );
  return result.rows.length === 0;
}

/**
 * Batch check: for a set of material+function pairs, return which ones
 * are new discoveries for this user.
 *
 * IMPORTANT: call this BEFORE createRun — once the run is written,
 * its own data makes the combination "not new".
 */
export async function getNewFunctionDiscoveriesBatch(
  userId: string,
  pairs: Array<{ material_id: string; function_used: string }>,
): Promise<Array<{ materialId: string; functionUsed: string; materialTitle: string }>> {
  if (pairs.length === 0) return [];

  const discoveries: Array<{ materialId: string; functionUsed: string; materialTitle: string }> = [];

  for (const pair of pairs) {
    if (!pair.function_used) continue;
    const isNew = await getNewFunctionDiscoveries(userId, pair.material_id, pair.function_used);
    if (isNew) {
      // Fetch material title for the toast
      const titleResult = await sql.query(
        `SELECT title FROM materials_cache WHERE id = $1 LIMIT 1`,
        [pair.material_id],
      );
      discoveries.push({
        materialId: pair.material_id,
        functionUsed: pair.function_used,
        materialTitle: (titleResult.rows[0]?.title as string) ?? "this material",
      });
    }
  }

  return discoveries;
}
