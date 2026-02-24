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
