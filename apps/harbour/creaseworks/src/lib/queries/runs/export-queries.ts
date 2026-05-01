/**
 * Export queries for runs (session 12).
 *
 * Fetch all visible runs without pagination, with materials
 * included inline as a comma-separated string for CSV friendliness.
 */

import { sql } from "@/lib/db";
import { RunRow, SessionExport } from "./types";

/**
 * Fetch all visible runs for export (CSV / PDF). Same visibility model
 * as getRunsForUser() but without pagination, and with materials
 * included inline as a comma-separated string for CSV friendliness.
 *
 * Reflective fields (what_changed, next_iteration) are only included
 * when the caller is internal (admin or @windedvertigo.com) or is the
 * run's creator — same rule as the API sanitisation logic.
 */
// Audit-2 M2: accept optional limit to cap export size and prevent OOM on Vercel
export async function getRunsForExport(
  session: SessionExport,
  limit: number = 500,
): Promise<(RunRow & { materials_list: string })[]> {
  let query: string;
  let params: any[];

  if (session.isAdmin) {
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug,
             COALESCE(
               (SELECT string_agg(m.title, ', ' ORDER BY m.title)
                FROM run_materials rm
                JOIN materials_cache m ON m.id = rm.material_id
                WHERE rm.run_id = r.id),
               ''
             ) AS materials_list
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $1
    `;
    params = [limit];
  } else if (session.orgId) {
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug,
             COALESCE(
               (SELECT string_agg(m.title, ', ' ORDER BY m.title)
                FROM run_materials rm
                JOIN materials_cache m ON m.id = rm.material_id
                WHERE rm.run_id = r.id),
               ''
             ) AS materials_list
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.org_id = $1
         OR r.created_by = $2
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $3
    `;
    params = [session.orgId, session.userId, limit];
  } else {
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug,
             COALESCE(
               (SELECT string_agg(m.title, ', ' ORDER BY m.title)
                FROM run_materials rm
                JOIN materials_cache m ON m.id = rm.material_id
                WHERE rm.run_id = r.id),
               ''
             ) AS materials_list
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.created_by = $1
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $2
    `;
    params = [session.userId, limit];
  }

  const result = await sql.query(query, params);

  // sanitise reflective fields for non-internal users viewing other people's runs
  return result.rows.map((run: any) => {
    if (session.isInternal || run.created_by === session.userId) {
      return run;
    }
    return {
      ...run,
      what_changed: null,
      next_iteration: null,
    };
  });
}
