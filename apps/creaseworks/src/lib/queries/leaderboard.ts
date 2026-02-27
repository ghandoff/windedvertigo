/**
 * Community leaderboard queries — fetch and manage leaderboard entries.
 *
 * The leaderboard displays top users ranked by total credits earned (earned - spent).
 * Only users who have explicitly opted in are included.
 * Display names are customizable for privacy.
 */

import { sql } from "@/lib/db";

/**
 * Leaderboard entry with all display metrics
 */
export interface LeaderboardEntry {
  rank: number;
  display_name: string;
  total_credits: number;
  current_streak: number;
  longest_streak: number;
  total_runs: number;
  gallery_shares: number;
  is_current_user: boolean;
}

/**
 * Leaderboard opt-in status
 */
export interface LeaderboardStatus {
  opted_in: boolean;
  display_name: string | null;
}

/**
 * Get the community leaderboard with top N users.
 *
 * Only includes users who have opted in (leaderboard_opted_in = true).
 * Ranked by total credits (earned - spent).
 * Includes streak data using gap-and-island technique.
 *
 * Display names: shows leaderboard_display_name if set, otherwise first word of name,
 * otherwise defaults to "explorer" for privacy.
 *
 * @param currentUserId Optional user ID to mark current user in results
 * @param limit Maximum number of entries to return (default 20)
 * @returns Array of leaderboard entries sorted by rank
 */
export async function getLeaderboard(
  currentUserId?: string,
  limit = 20,
): Promise<LeaderboardEntry[]> {
  try {
    const result = await sql.query(
      `WITH opted_in_users AS (
         SELECT
           u.id,
           u.email,
           u.name,
           u.leaderboard_display_name,
           COALESCE(
             u.leaderboard_display_name,
             SPLIT_PART(u.name, ' ', 1),
             'explorer'
           ) as display_name
         FROM users u
         WHERE u.leaderboard_opted_in = true
       ),
       user_credits AS (
         SELECT
           oiu.id,
           oiu.display_name,
           COALESCE((SELECT SUM(amount) FROM reflection_credits WHERE user_id = oiu.id), 0)
           -
           COALESCE((SELECT SUM(credits_spent) FROM credit_redemptions WHERE user_id = oiu.id), 0)
           AS total_credits
         FROM opted_in_users oiu
       ),
       user_stats AS (
         SELECT
           uc.id,
           uc.display_name,
           uc.total_credits,
           COUNT(DISTINCT rc.id)::int as total_runs,
           COUNT(DISTINCT CASE WHEN re.shared_to_gallery = true THEN re.id END)::int as gallery_shares
         FROM user_credits uc
         LEFT JOIN runs_cache rc ON rc.created_by = uc.id
         LEFT JOIN run_evidence re ON re.run_id = rc.id
         GROUP BY uc.id, uc.display_name, uc.total_credits
       ),
       streaks AS (
         SELECT
           u.id,
           COALESCE(
             (
               WITH daily_runs AS (
                 SELECT DISTINCT DATE(run_date) as run_day
                 FROM runs_cache
                 WHERE created_by = u.id AND run_date IS NOT NULL
               ),
               islands AS (
                 SELECT
                   run_day,
                   run_day - (ROW_NUMBER() OVER (ORDER BY run_day))::int * INTERVAL '1 day' as grp
                 FROM daily_runs
               ),
               streak_lengths AS (
                 SELECT
                   COUNT(*)::int as streak_length,
                   MAX(run_day) as streak_end
                 FROM islands
                 GROUP BY grp
               )
               SELECT COALESCE(MAX(streak_length), 0)
               FROM streak_lengths
             ),
             0
           )::int as longest_streak,
           COALESCE(
             (
               WITH daily_runs AS (
                 SELECT DISTINCT DATE(run_date) as run_day
                 FROM runs_cache
                 WHERE created_by = u.id AND run_date IS NOT NULL
               ),
               islands AS (
                 SELECT
                   run_day,
                   run_day - (ROW_NUMBER() OVER (ORDER BY run_day))::int * INTERVAL '1 day' as grp
                 FROM daily_runs
               ),
               streak_lengths AS (
                 SELECT
                   COUNT(*)::int as streak_length,
                   MAX(run_day) as streak_end
                 FROM islands
                 GROUP BY grp
               )
               SELECT streak_length
               FROM streak_lengths
               WHERE streak_end >= CURRENT_DATE - INTERVAL '1 day'
               ORDER BY streak_end DESC
               LIMIT 1
             ),
             0
           )::int as current_streak
         FROM opted_in_users u
       )
       SELECT
         ROW_NUMBER() OVER (ORDER BY us.total_credits DESC)::int as rank,
         us.display_name,
         us.total_credits,
         s.current_streak,
         s.longest_streak,
         us.total_runs,
         us.gallery_shares,
         (us.id = $2)::boolean as is_current_user
       FROM user_stats us
       LEFT JOIN streaks s ON s.id = us.id
       ORDER BY us.total_credits DESC
       LIMIT $1`,
      [limit, currentUserId || null],
    );

    return result.rows as LeaderboardEntry[];
  } catch (err) {
    console.error("[leaderboard] getLeaderboard failed:", err);
    return [];
  }
}

/**
 * Opt a user in to the leaderboard.
 *
 * @param userId User ID to opt in
 * @param displayName Optional custom display name (if not provided, uses first name or email)
 * @returns Updated leaderboard status
 */
export async function optInToLeaderboard(
  userId: string,
  displayName?: string | null,
): Promise<LeaderboardStatus> {
  try {
    const result = await sql.query(
      `UPDATE users
       SET leaderboard_opted_in = true, leaderboard_display_name = $2
       WHERE id = $1
       RETURNING leaderboard_opted_in as opted_in, leaderboard_display_name as display_name`,
      [userId, displayName || null],
    );

    const row = result.rows[0];
    return {
      opted_in: row?.opted_in ?? false,
      display_name: row?.display_name ?? null,
    };
  } catch (err) {
    console.error("[leaderboard] optInToLeaderboard failed:", err);
    throw err;
  }
}

/**
 * Opt a user out of the leaderboard.
 *
 * @param userId User ID to opt out
 * @returns Updated leaderboard status
 */
export async function optOutOfLeaderboard(userId: string): Promise<LeaderboardStatus> {
  try {
    const result = await sql.query(
      `UPDATE users
       SET leaderboard_opted_in = false, leaderboard_display_name = null
       WHERE id = $1
       RETURNING leaderboard_opted_in as opted_in, leaderboard_display_name as display_name`,
      [userId],
    );

    const row = result.rows[0];
    return {
      opted_in: row?.opted_in ?? false,
      display_name: row?.display_name ?? null,
    };
  } catch (err) {
    console.error("[leaderboard] optOutOfLeaderboard failed:", err);
    throw err;
  }
}

/**
 * Get the current leaderboard status for a user.
 *
 * @param userId User ID to check
 * @returns Current opt-in status and display name
 */
export async function getLeaderboardStatus(userId: string): Promise<LeaderboardStatus> {
  try {
    const result = await sql.query(
      `SELECT
         leaderboard_opted_in as opted_in,
         leaderboard_display_name as display_name
       FROM users
       WHERE id = $1`,
      [userId],
    );

    const row = result.rows[0];
    return {
      opted_in: row?.opted_in ?? false,
      display_name: row?.display_name ?? null,
    };
  } catch (err) {
    console.error("[leaderboard] getLeaderboardStatus failed:", err);
    return {
      opted_in: false,
      display_name: null,
    };
  }
}
