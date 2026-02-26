/**
 * Detail queries for individual runs.
 */

import { sql } from "@/lib/db";
import { RunRow, SessionVisibility } from "./types";

/**
 * Get a single run by ID with visibility check.
 * Returns null if the user doesn't have access.
 */
export async function getRunById(
  runId: string,
  session: SessionVisibility,
): Promise<RunRow | null> {
  const result = await sql.query(
    `SELECT r.id, r.title, r.run_type, r.run_date,
            r.context_tags, r.trace_evidence,
            r.what_changed, r.next_iteration,
            r.created_by, r.org_id,
            r.synced_at AS created_at,
            p.title AS playdate_title,
            p.slug AS playdate_slug
     FROM runs_cache r
     LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     WHERE r.id = $1
     LIMIT 1`,
    [runId],
  );

  const run = result.rows[0] ?? null;
  if (!run) return null;

  // Visibility check
  if (session.isAdmin) return run;
  if (run.created_by === session.userId) return run;
  if (session.orgId && run.org_id === session.orgId) return run;

  return null; // no access
}

/**
 * Get materials linked to a run.
 */
export async function getRunMaterials(
  runId: string,
): Promise<{ id: string; title: string }[]> {
  const result = await sql.query(
    `SELECT m.id, m.title
     FROM materials_cache m
     JOIN run_materials rm ON rm.material_id = m.id
     WHERE rm.run_id = $1
     ORDER BY m.title ASC`,
    [runId],
  );
  return result.rows;
}

/**
 * Batch-fetch materials for a list of run IDs in a single query.
 * Returns a map of runId → material array.
 *
 * Audit fix #9: replaces the N+1 pattern (one getRunMaterials call per
 * run) with a single query using ANY($1::uuid[]).
 */
export async function batchGetRunMaterials(
  runIds: string[],
): Promise<Map<string, { id: string; title: string }[]>> {
  const map = new Map<string, { id: string; title: string }[]>();
  if (runIds.length === 0) return map;

  const result = await sql.query(
    `SELECT rm.run_id, m.id, m.title
     FROM run_materials rm
     JOIN materials_cache m ON m.id = rm.material_id
     WHERE rm.run_id = ANY($1::uuid[])
     ORDER BY m.title ASC`,
    [runIds],
  );

  for (const row of result.rows) {
    const list = map.get(row.run_id) ?? [];
    list.push({ id: row.id, title: row.title });
    map.set(row.run_id, list);
  }
  return map;
}
