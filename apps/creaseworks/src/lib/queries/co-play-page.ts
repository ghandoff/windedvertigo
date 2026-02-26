/**
 * Queries for co-play page (public-facing, minimal auth required).
 */

import { sql } from "@/lib/db";

/**
 * Details needed for the co-play join page.
 */
export interface RunByInviteCodeResult {
  id: string;
  title: string;
  created_by: string;
  created_by_name: string | null;
  co_play_parent_id: string | null;
}

/**
 * Get run details by invite code.
 * Does not require auth — it's meant for public link sharing.
 * But it only returns runs that have an invite code.
 */
export async function getRunByInviteCode(
  inviteCode: string,
): Promise<RunByInviteCodeResult | null> {
  const result = await sql.query(
    `SELECT r.id, r.title, r.created_by, r.co_play_parent_id,
            u.name AS created_by_name
     FROM runs_cache r
     LEFT JOIN users u ON u.id = r.created_by
     WHERE r.co_play_invite_code = $1
     LIMIT 1`,
    [inviteCode.trim().toUpperCase()],
  );

  return result.rows[0] ?? null;
}
