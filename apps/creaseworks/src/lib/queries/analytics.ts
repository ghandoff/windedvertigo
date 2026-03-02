/**
 * Run analytics queries — aggregate statistics for the dashboard.
 *
 * All queries respect the same visibility model as getRunsForUser():
 *   - Admin: sees analytics across all runs
 *   - Org member: sees analytics for their org’s runs
 *   - No org: sees analytics for only their own runs
 *
 * MVP 7 — run analytics dashboard.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface RunsByType {
  run_type: string;
  count: number;
}

export interface RunsOverTime {
  month: string; // YYYY-MM
  count: number;
}

export interface TopPlaydate {
  playdate_title: string;
  playdate_slug: string;
  count: number;
}

export interface TopMaterial {
  material_title: string;
  count: number;
}

export interface EvidenceBreakdown {
  evidence_type: string;
  count: number;
}

export interface ContextBreakdown {
  context_tag: string;
  count: number;
}

export interface AnalyticsSummary {
  totalRuns: number;
  runsByType: RunsByType[];
  runsOverTime: RunsOverTime[];
  topPlaydates: TopPlaydate[];
  topMaterials: TopMaterial[];
  evidenceBreakdown: EvidenceBreakdown[];
  contextBreakdown: ContextBreakdown[];
  averageEvidencePerRun: number;
  runsThisMonth: number;
  runsLastMonth: number;
}

/* ------------------------------------------------------------------ */
/*  admin-only analytics types                                         */
/* ------------------------------------------------------------------ */

export interface UserGrowthPoint {
  month: string; // YYYY-MM
  signups: number;
  cumulative: number;
}

export interface PackAdoption {
  pack_title: string;
  org_count: number;
  user_count: number;
  total: number;
}

export interface CreditEconomy {
  total_earned: number;
  total_spent: number;
  total_balance: number;
  by_reason: { reason: string; amount: number }[];
}

export interface FunnelStep {
  label: string;
  count: number;
}

export interface AdminAnalytics {
  totalUsers: number;
  activeUsersThisMonth: number;
  userGrowth: UserGrowthPoint[];
  packAdoption: PackAdoption[];
  creditEconomy: CreditEconomy;
  funnel: FunnelStep[];
}

/* ------------------------------------------------------------------ */
/*  visibility clause builder                                          */
/* ------------------------------------------------------------------ */

// SAFETY (Audit-2 M1): visibilityClause().where is ALWAYS a hardcoded string
// literal — never derived from user input. The returned `where` is interpolated
// into SQL template literals below. If you ever need to include user-supplied
// values in the WHERE clause, pass them via `params` and use $N placeholders.
function visibilityClause(session: {
  userId: string;
  orgId: string | null;
  isAdmin: boolean;
}): { where: string; params: any[] } {
  if (session.isAdmin) {
    return { where: "1=1", params: [] };
  }
  if (session.orgId) {
    return {
      where: "(r.org_id = $1 OR r.created_by = $2)",
      params: [session.orgId, session.userId],
    };
  }
  return { where: "r.created_by = $1", params: [session.userId] };
}

/* ------------------------------------------------------------------ */
/*  aggregate queries                                                  */
/* ------------------------------------------------------------------ */

export async function getAnalytics(session: {
  userId: string;
  orgId: string | null;
  isAdmin: boolean;
}): Promise<AnalyticsSummary> {
  const vis = visibilityClause(session);

  // Total runs
  const totalResult = await sql.query(
    `SELECT COUNT(*)::int AS total FROM runs_cache r WHERE ${vis.where}`,
    vis.params,
  );
  const totalRuns = totalResult.rows[0]?.total ?? 0;

  // Runs by type
  const byTypeResult = await sql.query(
    `SELECT COALESCE(r.run_type, 'unspecified') AS run_type,
            COUNT(*)::int AS count
     FROM runs_cache r
     WHERE ${vis.where}
     GROUP BY r.run_type
     ORDER BY count DESC`,
    vis.params,
  );

  // Runs over time (last 12 months)
  const overTimeResult = await sql.query(
    `SELECT TO_CHAR(r.run_date::date, 'YYYY-MM') AS month,
            COUNT(*)::int AS count
     FROM runs_cache r
     WHERE ${vis.where}
       AND r.run_date IS NOT NULL
       AND r.run_date::date >= (CURRENT_DATE - INTERVAL '12 months')
     GROUP BY month
     ORDER BY month ASC`,
    vis.params,
  );

  // Top playdates (by run count)
  const topPlaydatesResult = await sql.query(
    `SELECT p.title AS playdate_title,
            p.slug AS playdate_slug,
            COUNT(*)::int AS count
     FROM runs_cache r
     JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
     WHERE ${vis.where}
       AND r.playdate_notion_id IS NOT NULL
     GROUP BY p.title, p.slug
     ORDER BY count DESC
     LIMIT 10`,
    vis.params,
  );

  // Top materials (by run linkage count)
  const topMaterialsResult = await sql.query(
    `SELECT m.title AS material_title,
            COUNT(*)::int AS count
     FROM runs_cache r
     JOIN run_materials rm ON rm.run_id = r.id
     JOIN materials_cache m ON m.id = rm.material_id
     WHERE ${vis.where}
     GROUP BY m.title
     ORDER BY count DESC
     LIMIT 10`,
    vis.params,
  );

  // Evidence breakdown (unnest the JSON array)
  const evidenceResult = await sql.query(
    `SELECT elem AS evidence_type,
            COUNT(*)::int AS count
     FROM runs_cache r,
          jsonb_array_elements_text(r.trace_evidence) AS elem
     WHERE ${vis.where}
     GROUP BY elem
     ORDER BY count DESC`,
    vis.params,
  );

  // Context tags breakdown
  const contextResult = await sql.query(
    `SELECT elem AS context_tag,
            COUNT(*)::int AS count
     FROM runs_cache r,
          jsonb_array_elements_text(r.context_tags) AS elem
     WHERE ${vis.where}
     GROUP BY elem
     ORDER BY count DESC`,
    vis.params,
  );

  // Average evidence types per run
  const avgEvidenceResult = await sql.query(
    `SELECT COALESCE(AVG(jsonb_array_length(r.trace_evidence)), 0)::float AS avg
     FROM runs_cache r
     WHERE ${vis.where}`,
    vis.params,
  );

  // Runs this month vs last month
  const monthCompareResult = await sql.query(
    `SELECT
       COUNT(*) FILTER (WHERE r.run_date::date >= DATE_TRUNC('month', CURRENT_DATE))::int AS this_month,
       COUNT(*) FILTER (WHERE r.run_date::date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
                          AND r.run_date::date < DATE_TRUNC('month', CURRENT_DATE))::int AS last_month
     FROM runs_cache r
     WHERE ${vis.where}
       AND r.run_date IS NOT NULL`,
    vis.params,
  );

  return {
    totalRuns,
    runsByType: byTypeResult.rows,
    runsOverTime: overTimeResult.rows,
    topPlaydates: topPlaydatesResult.rows,
    topMaterials: topMaterialsResult.rows,
    evidenceBreakdown: evidenceResult.rows,
    contextBreakdown: contextResult.rows,
    averageEvidencePerRun: Math.round((avgEvidenceResult.rows[0]?.avg ?? 0) * 10) / 10,
    runsThisMonth: monthCompareResult.rows[0]?.this_month ?? 0,
    runsLastMonth: monthCompareResult.rows[0]?.last_month ?? 0,
  };
}

/* ------------------------------------------------------------------ */
/*  admin-only platform analytics                                      */
/* ------------------------------------------------------------------ */

/**
 * Platform-level metrics for the admin analytics dashboard.
 * No visibility scoping — admin-only by design.
 *
 * Four sections:
 *   1. User growth (monthly signups with running cumulative)
 *   2. Pack adoption (org + user entitlements per pack)
 *   3. Credit economy (earned vs spent, breakdown by reason)
 *   4. Conversion funnel (signed up → onboarded → first run → repeat → purchased)
 */
export async function getAdminAnalytics(): Promise<AdminAnalytics> {
  // ── 1. User counts ──────────────────────────────────────────────────
  const usersResult = await sql.query(`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (
        WHERE last_active_at >= DATE_TRUNC('month', CURRENT_DATE)
           OR created_at >= DATE_TRUNC('month', CURRENT_DATE)
      )::int AS active_this_month
    FROM users
  `);
  const totalUsers = usersResult.rows[0]?.total ?? 0;
  const activeUsersThisMonth = usersResult.rows[0]?.active_this_month ?? 0;

  // ── 2. User growth (last 12 months) ─────────────────────────────────
  const growthResult = await sql.query(`
    WITH monthly AS (
      SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
             COUNT(*)::int AS signups
      FROM users
      WHERE created_at >= (CURRENT_DATE - INTERVAL '12 months')
      GROUP BY month
      ORDER BY month ASC
    )
    SELECT month, signups,
           SUM(signups) OVER (ORDER BY month)::int AS cumulative
    FROM monthly
  `);

  // ── 3. Pack adoption ────────────────────────────────────────────────
  const adoptionResult = await sql.query(`
    SELECT
      pc.title AS pack_title,
      COUNT(DISTINCT e.org_id) FILTER (WHERE e.org_id IS NOT NULL)::int AS org_count,
      COUNT(DISTINCT e.user_id) FILTER (WHERE e.user_id IS NOT NULL AND e.org_id IS NULL)::int AS user_count,
      COUNT(*)::int AS total
    FROM entitlements e
    JOIN packs_catalogue pc ON pc.id = e.pack_cache_id
    WHERE e.revoked_at IS NULL
      AND (e.expires_at IS NULL OR e.expires_at > NOW())
    GROUP BY pc.title
    ORDER BY total DESC
  `);

  // ── 4. Credit economy ──────────────────────────────────────────────
  const creditResult = await sql.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE amount > 0), 0)::int AS total_earned,
      COALESCE(ABS(SUM(amount) FILTER (WHERE amount < 0)), 0)::int AS total_spent
    FROM reflection_credits
  `);
  const totalEarned = creditResult.rows[0]?.total_earned ?? 0;
  const totalSpent = creditResult.rows[0]?.total_spent ?? 0;

  const byReasonResult = await sql.query(`
    SELECT reason,
           SUM(ABS(amount))::int AS amount
    FROM reflection_credits
    GROUP BY reason
    ORDER BY amount DESC
  `);

  // ── 5. Conversion funnel ───────────────────────────────────────────
  // Each step: how many users reached this milestone
  const funnelResult = await sql.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS signed_up,
      (SELECT COUNT(*)::int FROM users WHERE active_context_name IS NOT NULL) AS onboarded,
      (SELECT COUNT(DISTINCT created_by)::int FROM runs_cache) AS first_run,
      (SELECT COUNT(*)::int FROM (
        SELECT created_by FROM runs_cache
        GROUP BY created_by HAVING COUNT(*) >= 3
      ) repeat_users) AS repeat_users,
      (SELECT COUNT(DISTINCT COALESCE(e.org_id::text, e.user_id::text))::int
       FROM entitlements e
       WHERE e.purchase_id IS NOT NULL
         AND e.revoked_at IS NULL) AS purchased
  `);
  const f = funnelResult.rows[0];

  return {
    totalUsers,
    activeUsersThisMonth,
    userGrowth: growthResult.rows.map((r: any) => ({
      month: r.month,
      signups: r.signups,
      cumulative: r.cumulative,
    })),
    packAdoption: adoptionResult.rows,
    creditEconomy: {
      total_earned: totalEarned,
      total_spent: totalSpent,
      total_balance: totalEarned - totalSpent,
      by_reason: byReasonResult.rows,
    },
    funnel: [
      { label: "signed up", count: f?.signed_up ?? 0 },
      { label: "onboarded", count: f?.onboarded ?? 0 },
      { label: "first reflection", count: f?.first_run ?? 0 },
      { label: "3+ reflections", count: f?.repeat_users ?? 0 },
      { label: "purchased", count: f?.purchased ?? 0 },
    ],
  };
}
