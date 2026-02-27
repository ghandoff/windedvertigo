/**
 * API route: /api/partner/progress
 *
 * GET — fetch aggregate progress data for a partner's organization.
 *       No query parameters.
 *
 * Requires partner API key with scope: read:progress
 * Returns only aggregate data — no individual user information.
 *
 * Response includes:
 *   - totalUsers: count of users in org
 *   - totalRuns: aggregate run count across org
 *   - totalEvidence: aggregate evidence count across org
 *   - badgeCounts: aggregate badge progression (tried_it, found_something, folded_unfolded, found_again)
 *   - activeStreaks: count of users with current_streak > 0
 *   - totalCreditsEarned: sum of all credits earned across org
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerAuth, requireScope } from "@/lib/partner-auth";
import { sql } from "@/lib/db";

export async function GET(req: NextRequest) {
  // Validate partner API key
  const auth = await requirePartnerAuth(req);
  if (auth instanceof NextResponse) return auth;

  // Check scope
  if (!requireScope(auth, "read:progress")) {
    return NextResponse.json(
      { error: "insufficient permissions (requires read:progress scope)" },
      { status: 403 },
    );
  }

  try {
    // Get all aggregate stats in parallel
    const [
      totalUsersResult,
      totalRunsResult,
      totalEvidenceResult,
      badgeCountsResult,
      activeStreaksResult,
      totalCreditsResult,
    ] = await Promise.all([
      // Total users in org
      sql.query(
        `SELECT COUNT(DISTINCT user_id)::int as count
         FROM org_users
         WHERE org_id = $1`,
        [auth.orgId],
      ),

      // Total runs across org
      sql.query(
        `SELECT COUNT(rc.id)::int as count
         FROM runs_cache rc
         INNER JOIN org_users ou ON ou.user_id = rc.created_by
         WHERE ou.org_id = $1`,
        [auth.orgId],
      ),

      // Total evidence across org
      sql.query(
        `SELECT COUNT(re.id)::int as count
         FROM run_evidence re
         INNER JOIN runs_cache rc ON rc.id = re.run_id
         INNER JOIN org_users ou ON ou.user_id = rc.created_by
         WHERE ou.org_id = $1`,
        [auth.orgId],
      ),

      // Aggregate badge counts (from playdate_progress)
      sql.query(
        `SELECT
           COUNT(CASE WHEN pp.progress_tier IS NOT NULL THEN 1 END)::int as tried_it,
           COUNT(CASE WHEN pp.progress_tier IN ('found_something', 'folded_unfolded', 'found_again') THEN 1 END)::int as found_something,
           COUNT(CASE WHEN pp.progress_tier IN ('folded_unfolded', 'found_again') THEN 1 END)::int as folded_unfolded,
           COUNT(CASE WHEN pp.progress_tier = 'found_again' THEN 1 END)::int as found_again
         FROM playdate_progress pp
         INNER JOIN org_users ou ON ou.user_id = pp.user_id
         WHERE ou.org_id = $1`,
        [auth.orgId],
      ),

      // Count users with active streaks (current_streak > 0)
      sql.query(
        `WITH daily_runs AS (
           SELECT DISTINCT ou.user_id, DATE(rc.run_date) as run_day
           FROM runs_cache rc
           INNER JOIN org_users ou ON ou.user_id = rc.created_by
           WHERE ou.org_id = $1 AND rc.run_date IS NOT NULL
         ),
         islands AS (
           SELECT
             user_id,
             run_day,
             run_day - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY run_day))::int * INTERVAL '1 day' as grp
           FROM daily_runs
         ),
         streak_lengths AS (
           SELECT
             user_id,
             COUNT(*)::int as streak_length,
             MAX(run_day) as streak_end
           FROM islands
           GROUP BY user_id, grp
         )
         SELECT COUNT(DISTINCT user_id)::int as count
         FROM streak_lengths
         WHERE streak_end >= CURRENT_DATE - INTERVAL '1 day'
           AND streak_length > 0`,
        [auth.orgId],
      ),

      // Total credits earned across org
      sql.query(
        `SELECT COALESCE(SUM(rc.amount), 0)::int as total
         FROM reflection_credits rc
         INNER JOIN org_users ou ON ou.user_id = rc.user_id
         WHERE ou.org_id = $1`,
        [auth.orgId],
      ),
    ]);

    const totalUsers = totalUsersResult.rows[0]?.count ?? 0;
    const totalRuns = totalRunsResult.rows[0]?.count ?? 0;
    const totalEvidence = totalEvidenceResult.rows[0]?.count ?? 0;
    const activeStreaks = activeStreaksResult.rows[0]?.count ?? 0;
    const totalCreditsEarned = totalCreditsResult.rows[0]?.total ?? 0;

    const badgeData = badgeCountsResult.rows[0] ?? {
      tried_it: 0,
      found_something: 0,
      folded_unfolded: 0,
      found_again: 0,
    };

    return NextResponse.json({
      data: {
        totalUsers,
        totalRuns,
        totalEvidence,
        badgeCounts: {
          tried_it: badgeData.tried_it ?? 0,
          found_something: badgeData.found_something ?? 0,
          folded_unfolded: badgeData.folded_unfolded ?? 0,
          found_again: badgeData.found_again ?? 0,
        },
        activeStreaks,
        totalCreditsEarned,
      },
    });
  } catch (error) {
    console.error("[partner-progress] GET error:", error);
    return NextResponse.json(
      { error: "failed to fetch progress data" },
      { status: 500 },
    );
  }
}
