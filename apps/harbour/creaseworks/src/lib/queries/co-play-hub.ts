/**
 * Queries for the co-play hub page.
 */

import { sql } from "@/lib/db";

export interface RecentCoPlayRun {
  id: string;
  title: string;
  inviteCode: string;
  partnerName: string | null;
  createdAt: string;
}

/**
 * Get recent runs where co-play is enabled for this user
 * (either as creator or as partner).
 */
export async function getRecentCoPlayRuns(
  userId: string,
): Promise<RecentCoPlayRun[]> {
  const result = await sql.query(
    `SELECT
       rc.id,
       rc.title,
       rc.co_play_invite_code AS invite_code,
       CASE
         WHEN rc.created_by = $1 THEN partner.name
         ELSE creator.name
       END AS partner_name,
       rc.synced_at
     FROM runs_cache rc
     LEFT JOIN users creator ON creator.id = rc.created_by
     LEFT JOIN users partner ON partner.id = rc.co_play_parent_id
     WHERE rc.co_play_invite_code IS NOT NULL
       AND (rc.created_by = $1 OR rc.co_play_parent_id = $1)
     ORDER BY rc.synced_at DESC
     LIMIT 10`,
    [userId],
  );

  return result.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    title: row.title as string,
    inviteCode: row.invite_code as string,
    partnerName: row.partner_name as string | null,
    createdAt: row.synced_at as string,
  }));
}
