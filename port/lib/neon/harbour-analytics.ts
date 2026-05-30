/**
 * Harbour-wide analytics queries — L2 business metrics.
 *
 * All data comes from the shared Neon Postgres instance used by harbour-apps.
 * Every aggregate accepts an optional `app` slug that re-scopes purchases,
 * entitlements, and pack adoption to a single app. Metrics that live on
 * app-agnostic tables (users, harbour_knots) are always harbour-wide.
 *
 * Key tables:
 *   users                 — platform accounts (no app column; harbour-wide)
 *   purchases             — payments; purchases.app added in migration 050
 *   packs_catalogue       — commerce catalogue; .app added in migration 050
 *   entitlements          — active grants; links to packs_catalogue via pack_cache_id
 *   harbour_knots         — engagement ledger; no app column (harbour-wide)
 *   dc_usage_events       — depth-chart telemetry; event_type='task_generated'
 *
 * @neondatabase/serverless note: one SQL statement per HTTP call.
 * Queries here use CTEs / subqueries to minimise round-trips.
 */

import { harbourSql, isNeonConfigured } from "./client";

// ── types ────────────────────────────────────────────────────────────────────

export interface HarbourSummary {
  totalUsers: number;
  activeUsersThisMonth: number;
  /** Count of completed purchases (filtered by app if provided). */
  totalPurchases: number;
  /** Revenue in cents from completed purchases (filtered by app if provided). */
  totalRevenueCents: number;
  /** Count of active entitlements (filtered by app if provided). */
  activeEntitlements: number;
}

export interface UserGrowthPoint {
  month: string; // YYYY-MM
  signups: number;
  cumulative: number;
}

export interface PackAdoptionRow {
  app: string;
  packTitle: string;
  entitlementCount: number;
  purchaseCount: number;
}

export interface FunnelStep {
  label: string;
  count: number;
}

export interface KnotsEconomy {
  totalEarned: number;
  totalSpent: number;
  byReason: { reason: string; amount: number }[];
}

export interface DepthChartUsage {
  totalEvents: number;
  tasksGenerated: number;
  plansCreated: number;
}

export interface HarbourAnalytics {
  summary: HarbourSummary;
  userGrowth: UserGrowthPoint[];
  packAdoption: PackAdoptionRow[];
  funnel: FunnelStep[];
  knots: KnotsEconomy;
  depthChart: DepthChartUsage;
  /** If true, POSTGRES_URL was absent — all values are zeroed. */
  unavailable?: boolean;
}

const EMPTY: HarbourAnalytics = {
  unavailable: true,
  summary: {
    totalUsers: 0,
    activeUsersThisMonth: 0,
    totalPurchases: 0,
    totalRevenueCents: 0,
    activeEntitlements: 0,
  },
  userGrowth: [],
  packAdoption: [],
  funnel: [
    { label: "signed up", count: 0 },
    { label: "first purchase", count: 0 },
    { label: "active entitlement", count: 0 },
  ],
  knots: { totalEarned: 0, totalSpent: 0, byReason: [] },
  depthChart: { totalEvents: 0, tasksGenerated: 0, plansCreated: 0 },
};

// ── main query ───────────────────────────────────────────────────────────────

/**
 * Fetch all harbour analytics in one pass.
 *
 * @param app  Optional harbour app slug (e.g. "creaseworks", "depth-chart").
 *             When provided, purchase / entitlement / pack metrics are scoped
 *             to that app. User and knots metrics are always harbour-wide.
 */
export async function getHarbourAnalytics(
  app?: string,
): Promise<HarbourAnalytics> {
  if (!isNeonConfigured()) return EMPTY;

  // Build conditional fragment for app filter (used in purchases + packs_catalogue)
  const appParam: unknown[] = app ? [app] : [];
  const appWhere = app ? "AND p.app = $1" : "";
  const packAppWhere = app ? "AND pc.app = $1" : "";

  try {
    // ── 1. Summary (single round-trip via subqueries) ─────────────────────────
    const summaryResult = await harbourSql.query(
      `SELECT
        (SELECT COUNT(*)::int FROM users)                                           AS total_users,
        (SELECT COUNT(*)::int FROM users
         WHERE last_active_at >= DATE_TRUNC('month', CURRENT_DATE)
            OR created_at      >= DATE_TRUNC('month', CURRENT_DATE))               AS active_this_month,
        (SELECT COUNT(*)::int   FROM purchases p WHERE p.status = 'completed' ${appWhere})     AS total_purchases,
        (SELECT COALESCE(SUM(p.amount_cents), 0)::bigint
         FROM purchases p WHERE p.status = 'completed' ${appWhere})                AS total_revenue_cents,
        (SELECT COUNT(*)::int FROM entitlements e
         JOIN packs_catalogue pc ON pc.id = e.pack_cache_id
         WHERE e.revoked_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > NOW())
           ${packAppWhere})                                                         AS active_entitlements`,
      appParam,
    );
    const s = summaryResult.rows[0] ?? {};

    // ── 2. User growth — last 12 months (always harbour-wide) ────────────────
    const growthResult = await harbourSql.query(`
      WITH monthly AS (
        SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
               COUNT(*)::int                  AS signups
        FROM users
        WHERE created_at >= (CURRENT_DATE - INTERVAL '12 months')
        GROUP BY month
        ORDER BY month ASC
      )
      SELECT month, signups,
             SUM(signups) OVER (ORDER BY month)::int AS cumulative
      FROM monthly
    `);

    // ── 3. Pack adoption ──────────────────────────────────────────────────────
    const adoptionResult = await harbourSql.query(
      `SELECT
        pc.app                                                              AS app,
        pc.title                                                            AS pack_title,
        COUNT(*)::int                                                       AS entitlement_count,
        COUNT(e.purchase_id)::int                                          AS purchase_count
      FROM entitlements e
      JOIN packs_catalogue pc ON pc.id = e.pack_cache_id
      WHERE e.revoked_at IS NULL
        AND (e.expires_at IS NULL OR e.expires_at > NOW())
        ${packAppWhere}
      GROUP BY pc.app, pc.title
      ORDER BY entitlement_count DESC
      LIMIT 20`,
      appParam,
    );

    // ── 4. Conversion funnel ─────────────────────────────────────────────────
    const funnelResult = await harbourSql.query(
      `SELECT
        (SELECT COUNT(*)::int FROM users)                                   AS signed_up,
        (SELECT COUNT(DISTINCT COALESCE(p.user_id, p.purchaser_id))::int
         FROM purchases p WHERE p.status = 'completed' ${appWhere})        AS first_purchase,
        (SELECT COUNT(DISTINCT COALESCE(e.user_id, e.org_id::text)::text)::int
         FROM entitlements e
         JOIN packs_catalogue pc ON pc.id = e.pack_cache_id
         WHERE e.revoked_at IS NULL
           AND (e.expires_at IS NULL OR e.expires_at > NOW())
           ${packAppWhere})                                                 AS active_entitlement`,
      appParam,
    );
    const f = funnelResult.rows[0] ?? {};

    // ── 5. Knots economy (always harbour-wide; no app column) ────────────────
    const knotsResult = await harbourSql.query(`
      SELECT
        COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::int    AS total_earned,
        COALESCE(ABS(SUM(delta) FILTER (WHERE delta < 0)), 0)::int AS total_spent
      FROM harbour_knots
    `);
    const knotsByReasonResult = await harbourSql.query(`
      SELECT reason,
             SUM(ABS(delta))::int AS amount
      FROM harbour_knots
      GROUP BY reason
      ORDER BY amount DESC
      LIMIT 10
    `);

    // ── 6. Depth-chart usage ─────────────────────────────────────────────────
    // Only meaningful for depth-chart; shown as context when app filter is
    // 'depth-chart' or when no filter is set (gives a harbour-wide signal of
    // AI usage load).
    const dcResult = await harbourSql.query(`
      SELECT
        COUNT(*)::int                                              AS total_events,
        COUNT(*) FILTER (WHERE event_type = 'task_generated')::int AS tasks_generated,
        (SELECT COUNT(*)::int FROM dc_plans)                       AS plans_created
      FROM dc_usage_events
    `);
    const dc = dcResult.rows[0] ?? {};

    return {
      summary: {
        totalUsers: s.total_users ?? 0,
        activeUsersThisMonth: s.active_this_month ?? 0,
        totalPurchases: s.total_purchases ?? 0,
        totalRevenueCents: Number(s.total_revenue_cents ?? 0),
        activeEntitlements: s.active_entitlements ?? 0,
      },
      userGrowth: (growthResult.rows ?? []).map((r) => ({
        month: r.month,
        signups: r.signups,
        cumulative: r.cumulative,
      })),
      packAdoption: (adoptionResult.rows ?? []).map((r) => ({
        app: r.app,
        packTitle: r.pack_title,
        entitlementCount: r.entitlement_count,
        purchaseCount: r.purchase_count,
      })),
      funnel: [
        { label: "signed up", count: f.signed_up ?? 0 },
        { label: "first purchase", count: f.first_purchase ?? 0 },
        { label: "active entitlement", count: f.active_entitlement ?? 0 },
      ],
      knots: {
        totalEarned: knotsResult.rows[0]?.total_earned ?? 0,
        totalSpent: knotsResult.rows[0]?.total_spent ?? 0,
        byReason: (knotsByReasonResult.rows ?? []).map((r) => ({
          reason: r.reason,
          amount: r.amount,
        })),
      },
      depthChart: {
        totalEvents: dc.total_events ?? 0,
        tasksGenerated: dc.tasks_generated ?? 0,
        plansCreated: dc.plans_created ?? 0,
      },
    };
  } catch (err) {
    console.error("[harbour-analytics] query failed:", err);
    return EMPTY;
  }
}
