/**
 * Profile stats query — comprehensive dashboard data for user profile.
 *
 * Retrieves all the metrics needed for the profile dashboard:
 * - Activity counts (runs, playdates tried, evidence)
 * - Streak calculations (current and longest consecutive days)
 * - Badge progression (count of each tier achievement)
 * - Recent activity feed (last 5 runs)
 * - Favorite collection (most runs in a single collection)
 */

import { sql } from "@/lib/db";

/**
 * Badge type enum matching the progress_tier values
 */
export type BadgeType = "tried_it" | "found_something" | "folded_unfolded" | "found_again";

/**
 * Badge progression counts
 */
export interface BadgeCounts {
  tried_it: number;
  found_something: number;
  folded_unfolded: number;
  found_again: number;
}

/**
 * Recent run activity
 */
export interface RecentActivity {
  id: string;
  title: string;
  playdate_title: string | null;
  run_date: string | null;
  badge_earned: BadgeType | null;
}

/**
 * Favorite collection info
 */
export interface FavoriteCollection {
  id: string;
  title: string;
  icon_emoji: string | null;
  run_count: number;
}

/**
 * Complete profile stats object
 */
export interface ProfileStats {
  totalRuns: number;
  totalPlaydatesTried: number;
  totalEvidence: number;
  currentStreak: number;
  longestStreak: number;
  galleryShares: number;
  badgeCounts: BadgeCounts;
  recentActivity: RecentActivity[];
  favoriteCollection: FavoriteCollection | null;
}

/**
 * Get comprehensive profile stats for a user
 */
export async function getProfileStats(userId: string): Promise<ProfileStats> {
  // Get all stats in parallel
  const [
    totalRunsResult,
    totalPlaydatesResult,
    totalEvidenceResult,
    streakResult,
    badgeCountsResult,
    recentActivityResult,
    favoriteCollectionResult,
    gallerySharesResult,
  ] = await Promise.all([
    // Total runs
    sql.query(`SELECT COUNT(*)::int as count FROM runs_cache WHERE created_by = $1`, [userId]),

    // Total distinct playdates tried
    sql.query(
      `SELECT COUNT(DISTINCT playdate_notion_id)::int as count
       FROM runs_cache
       WHERE created_by = $1 AND playdate_notion_id IS NOT NULL`,
      [userId],
    ),

    // Total evidence items
    sql.query(
      `SELECT COUNT(re.id)::int as count
       FROM run_evidence re
       INNER JOIN runs_cache rc ON rc.id = re.run_id
       WHERE rc.created_by = $1`,
      [userId],
    ),

    // Current and longest streaks
    sql.query(
      `WITH daily_runs AS (
         SELECT DISTINCT DATE(run_date) as run_day
         FROM runs_cache
         WHERE created_by = $1 AND run_date IS NOT NULL
         ORDER BY run_day
       ),
       streaks AS (
         SELECT
           run_day,
           ROW_NUMBER() OVER (ORDER BY run_day) -
           ROW_NUMBER() OVER (ORDER BY run_day) FILTER (WHERE LAG(run_day) OVER (ORDER BY run_day) = run_day - INTERVAL '1 day') as streak_group
         FROM daily_runs
       ),
       streak_lengths AS (
         SELECT
           streak_group,
           COUNT(*)::int as streak_length,
           MAX(run_day) as streak_end_date
         FROM streaks
         GROUP BY streak_group
       ),
       longest_streak AS (
         SELECT MAX(streak_length)::int as longest FROM streak_lengths
       ),
       current_streak_calc AS (
         SELECT
           CASE
             WHEN MAX(streak_end_date) = CURRENT_DATE THEN
               (SELECT streak_length FROM streak_lengths WHERE streak_end_date = CURRENT_DATE)
             WHEN MAX(streak_end_date) = CURRENT_DATE - INTERVAL '1 day' THEN
               (SELECT streak_length FROM streak_lengths WHERE streak_end_date = CURRENT_DATE - INTERVAL '1 day')
             ELSE 0
           END::int as current_streak
         FROM streak_lengths
       )
       SELECT
         COALESCE((SELECT current_streak FROM current_streak_calc), 0)::int as current_streak,
         COALESCE((SELECT longest FROM longest_streak), 0)::int as longest_streak`,
      [userId],
    ),

    // Badge counts from pattern_progress
    sql.query(
      `SELECT
         COUNT(CASE WHEN progress_tier IS NOT NULL THEN 1 END)::int as tried_it,
         COUNT(CASE WHEN progress_tier IN ('found_something', 'folded_unfolded', 'found_again') THEN 1 END)::int as found_something,
         COUNT(CASE WHEN progress_tier IN ('folded_unfolded', 'found_again') THEN 1 END)::int as folded_unfolded,
         COUNT(CASE WHEN progress_tier = 'found_again' THEN 1 END)::int as found_again
       FROM pattern_progress
       WHERE user_id = $1`,
      [userId],
    ),

    // Recent activity (last 5 runs with badge info)
    sql.query(
      `SELECT
         rc.id,
         rc.title,
         pc.title as playdate_title,
         rc.run_date,
         pp.progress_tier::text as badge_earned
       FROM runs_cache rc
       LEFT JOIN playdates_cache pc ON pc.notion_id = rc.playdate_notion_id
       LEFT JOIN pattern_progress pp ON pp.user_id = $1 AND pp.pattern_id = (
         SELECT id FROM patterns_cache WHERE notion_id = rc.pattern_notion_id LIMIT 1
       )
       WHERE rc.created_by = $1
       ORDER BY rc.run_date DESC NULLS LAST, rc.created_at DESC
       LIMIT 5`,
      [userId],
    ),

    // Favorite collection (most runs)
    sql.query(
      `SELECT
         c.id,
         c.title,
         c.icon_emoji,
         COUNT(rc.id)::int as run_count
       FROM collections c
       INNER JOIN collection_patterns cp ON cp.collection_id = c.id
       INNER JOIN patterns_cache pc ON pc.id = cp.pattern_id
       INNER JOIN runs_cache rc ON rc.pattern_notion_id = pc.notion_id
       WHERE rc.created_by = $1
       GROUP BY c.id, c.title, c.icon_emoji
       ORDER BY run_count DESC
       LIMIT 1`,
      [userId],
    ),

    // Gallery shares
    sql.query(
      `SELECT COUNT(re.id)::int as count
       FROM run_evidence re
       INNER JOIN runs_cache rc ON rc.id = re.run_id
       WHERE rc.created_by = $1 AND re.shared_to_gallery = true`,
      [userId],
    ),
  ]);

  // Extract results
  const totalRuns = totalRunsResult.rows[0]?.count ?? 0;
  const totalPlaydatesTried = totalPlaydatesResult.rows[0]?.count ?? 0;
  const totalEvidence = totalEvidenceResult.rows[0]?.count ?? 0;
  const galleryShares = gallerySharesResult.rows[0]?.count ?? 0;

  const streakData = streakResult.rows[0] ?? { current_streak: 0, longest_streak: 0 };
  const currentStreak = streakData.current_streak ?? 0;
  const longestStreak = streakData.longest_streak ?? 0;

  const badgeData = badgeCountsResult.rows[0] ?? {
    tried_it: 0,
    found_something: 0,
    folded_unfolded: 0,
    found_again: 0,
  };

  const badgeCounts: BadgeCounts = {
    tried_it: badgeData.tried_it ?? 0,
    found_something: badgeData.found_something ?? 0,
    folded_unfolded: badgeData.folded_unfolded ?? 0,
    found_again: badgeData.found_again ?? 0,
  };

  const recentActivity: RecentActivity[] = recentActivityResult.rows.map((row: any) => ({
    id: row.id,
    title: row.title,
    playdate_title: row.playdate_title,
    run_date: row.run_date,
    badge_earned: row.badge_earned as BadgeType | null,
  }));

  const favoriteCollection: FavoriteCollection | null = favoriteCollectionResult.rows[0]
    ? {
        id: favoriteCollectionResult.rows[0].id,
        title: favoriteCollectionResult.rows[0].title,
        icon_emoji: favoriteCollectionResult.rows[0].icon_emoji,
        run_count: favoriteCollectionResult.rows[0].run_count,
      }
    : null;

  return {
    totalRuns,
    totalPlaydatesTried,
    totalEvidence,
    currentStreak,
    longestStreak,
    galleryShares,
    badgeCounts,
    recentActivity,
    favoriteCollection,
  };
}
