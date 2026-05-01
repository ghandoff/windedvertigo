/**
 * List queries for runs.
 *
 * Visibility model (from DESIGN.md section 10):
 *   - Internal admins: see all runs across all orgs
 *   - Internal org users: see all runs for their org
 *   - External org users: see only their own runs
 */

import { sql } from "@/lib/db";
import { RunRow, SessionVisibility } from "./types";

/**
 * List runs based on the caller's visibility.
 *
 * - Admin: all runs, ordered by date DESC
 * - Org member (internal): all runs for their org
 * - Org member (external): only runs they created
 * - No org: only runs they created
 */
export async function getRunsForUser(
  session: SessionVisibility,
  limit = 50,
  offset = 0,
): Promise<RunRow[]> {
  let query: string;
  let params: any[];

  if (session.isAdmin) {
    // Admins see all runs
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $1 OFFSET $2
    `;
    params = [limit, offset];
  } else if (session.orgId) {
    // Org members see all runs for their org
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.org_id = $1
         OR r.created_by = $2
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $3 OFFSET $4
    `;
    params = [session.orgId, session.userId, limit, offset];
  } else {
    // No org: only own runs
    query = `
      SELECT r.id, r.title, r.run_type, r.run_date,
             r.context_tags, r.trace_evidence,
             r.what_changed, r.next_iteration,
             r.created_by, r.org_id,
             r.synced_at AS created_at,
             p.title AS playdate_title,
             p.slug AS playdate_slug
      FROM runs_cache r
      LEFT JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
      WHERE r.created_by = $1
      ORDER BY r.run_date DESC NULLS LAST, r.title ASC
      LIMIT $2 OFFSET $3
    `;
    params = [session.userId, limit, offset];
  }

  const result = await sql.query(query, params);
  return result.rows;
}
