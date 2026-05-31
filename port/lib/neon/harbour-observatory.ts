/**
 * Observatory-tab queries — cohort and engagement analytics.
 *
 * Implements the Duolingo 7-bucket user state model (approximated from
 * last_active_at), Mighty Networks-style knots activity sparkline,
 * pack discovery funnel, revenue cohort grid, and player leaderboard.
 *
 * All L2 data — no web session events required.
 */

import { harbourSql, isNeonConfigured } from "./client";

// ── types ─────────────────────────────────────────────────────────────────────

/**
 * Duolingo-inspired user state buckets (approximated from last_active_at).
 *
 * Full 7-bucket model requires activity-sequence history; we derive 6 buckets
 * from last_active_at + created_at which are available today.
 *   new          — created within past 14 days (still onboarding)
 *   current      — active in past 7 days, signed up >14 days ago (CURR)
 *   at_risk_wau  — last active 8–14 days ago
 *   at_risk_mau  — last active 15–30 days ago
 *   dormant      — last active >30 days ago (was once active)
 *   never_active — no last_active_at, signed up >14 days ago
 */
export interface UserStateBuckets {
  new: number;
  current: number;       // CURR — the highest-leverage metric (Duolingo: 5× impact)
  atRiskWau: number;
  atRiskMau: number;
  dormant: number;
  neverActive: number;
  total: number;
}

/** Daily knots activity for the past 30 days — sparkline data. */
export interface KnotsDay {
  date: string;   // YYYY-MM-DD
  earned: number;
  spent: number;
}

/** Four-step pack discovery funnel. */
export interface PackFunnel {
  totalUsers: number;
  withEntitlement: number;       // any active entitlement
  withPaidEntitlement: number;   // entitlement linked to a purchase
  activePostPurchase: number;    // last_active_at >= purchase date (proxy activation)
}

/** One row of the revenue cohort grid (signup month × months-to-first-purchase). */
export interface RevenueCohortRow {
  cohortMonth: string;  // YYYY-MM
  cohortSize: number;
  byMonth0: number;     // % purchased within first month
  byMonth1: number;     // % purchased within 2 months
  byMonth2: number;
  byMonth3: number;
}

/** One row in the player engagement leaderboard. */
export interface PlayerRow {
  name: string | null;
  email: string;
  knotsEarned: number;
  knotsSpent: number;
  knotsTotal: number;
  lastActive: string | null;
}

// ── access code analytics ──────────────────────────────────────────────────

export interface CampaignCodeStats {
  campaign: string;
  totalCodes: number;
  activeCodes: number;           // not expired or revoked
  totalRedemptions: number;
  redemptionsThisWeek: number;
  /** 0–1: fraction of redeeming users with last_active_at > redeemed_at */
  activationRate: number;
}

export interface CodeRedemptionDay {
  date: string;      // YYYY-MM-DD
  campaign: string;
  count: number;
}

export interface AccessCodeMetrics {
  byCampaign: CampaignCodeStats[];
  dailyRedemptions30d: CodeRedemptionDay[];
  totalRedemptionsAllTime: number;
  totalActiveCodes: number;
}

// ── combined metrics ──────────────────────────────────────────────────────

export interface ObservatoryMetrics {
  userStateBuckets: UserStateBuckets;
  knotsActivity30d: KnotsDay[];
  packFunnel: PackFunnel;
  revenueCohorts: RevenueCohortRow[];
  playerLeaderboard: PlayerRow[];
  accessCodes: AccessCodeMetrics;
  unavailable?: boolean;
  error?: string;
}

const EMPTY_BUCKETS: UserStateBuckets = {
  new: 0, current: 0, atRiskWau: 0, atRiskMau: 0, dormant: 0, neverActive: 0, total: 0,
};

const EMPTY_ACCESS_CODES: AccessCodeMetrics = {
  byCampaign: [],
  dailyRedemptions30d: [],
  totalRedemptionsAllTime: 0,
  totalActiveCodes: 0,
};

const EMPTY_OBSERVATORY: ObservatoryMetrics = {
  unavailable: true,
  userStateBuckets: EMPTY_BUCKETS,
  knotsActivity30d: [],
  packFunnel: { totalUsers: 0, withEntitlement: 0, withPaidEntitlement: 0, activePostPurchase: 0 },
  revenueCohorts: [],
  playerLeaderboard: [],
  accessCodes: EMPTY_ACCESS_CODES,
};

// ── main query ────────────────────────────────────────────────────────────────

export async function getObservatoryMetrics(app?: string): Promise<ObservatoryMetrics> {
  if (!isNeonConfigured()) {
    return { ...EMPTY_OBSERVATORY, error: "POSTGRES_URL is not set in the CF Worker environment" };
  }

  const appParam: unknown[]  = app ? [app] : [];
  const appWhere             = app ? "AND p.app = $1" : "";
  const packAppWhere         = app ? "AND pcat.app = $1" : "";

  try {
    const [bucketsResult, knotsResult, funnelResult, cohortResult, leaderboardResult,
           codeStatsResult, codeDailyResult, codeTotalsResult] =
      await Promise.all([

        // ── 1. User state buckets ───────────────────────────────────────────
        harbourSql.query(`
          SELECT
            COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '14 days')::int           AS "new",
            COUNT(*) FILTER (
              WHERE last_active_at >= NOW() - INTERVAL '7 days'
                AND created_at < NOW() - INTERVAL '14 days'
            )::int                                                                            AS current_users,
            COUNT(*) FILTER (
              WHERE last_active_at >= NOW() - INTERVAL '14 days'
                AND last_active_at <  NOW() - INTERVAL '7 days'
                AND created_at < NOW() - INTERVAL '14 days'
            )::int                                                                            AS at_risk_wau,
            COUNT(*) FILTER (
              WHERE last_active_at >= NOW() - INTERVAL '30 days'
                AND last_active_at <  NOW() - INTERVAL '14 days'
            )::int                                                                            AS at_risk_mau,
            COUNT(*) FILTER (
              WHERE last_active_at IS NOT NULL
                AND last_active_at < NOW() - INTERVAL '30 days'
            )::int                                                                            AS dormant,
            COUNT(*) FILTER (
              WHERE last_active_at IS NULL
                AND created_at < NOW() - INTERVAL '14 days'
            )::int                                                                            AS never_active,
            COUNT(*)::int                                                                     AS total
          FROM users
        `),

        // ── 2. Knots 30-day daily activity ─────────────────────────────────
        harbourSql.query(`
          SELECT
            DATE_TRUNC('day', created_at)::date::text                                        AS day,
            COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::int                            AS earned,
            COALESCE(ABS(SUM(delta) FILTER (WHERE delta < 0)), 0)::int                       AS spent
          FROM harbour_knots
          WHERE created_at >= NOW() - INTERVAL '30 days'
          GROUP BY day
          ORDER BY day ASC
        `),

        // ── 3. Pack discovery funnel ────────────────────────────────────────
        harbourSql.query(
          `SELECT
            (SELECT COUNT(*)::int FROM users)                                                 AS total_users,
            (SELECT COUNT(DISTINCT COALESCE(e.user_id::text, e.org_id::text))::int
             FROM entitlements e
             JOIN packs_catalogue pcat ON pcat.pack_cache_id = e.pack_cache_id
             WHERE e.revoked_at IS NULL
               AND (e.expires_at IS NULL OR e.expires_at > NOW())
               ${packAppWhere})                                                               AS with_entitlement,
            (SELECT COUNT(DISTINCT COALESCE(e.user_id::text, e.org_id::text))::int
             FROM entitlements e
             JOIN packs_catalogue pcat ON pcat.pack_cache_id = e.pack_cache_id
             WHERE e.revoked_at IS NULL
               AND (e.expires_at IS NULL OR e.expires_at > NOW())
               AND e.purchase_id IS NOT NULL
               ${packAppWhere})                                                               AS with_paid_entitlement,
            (SELECT COUNT(DISTINCT COALESCE(p.user_id, p.purchaser_id))::int
             FROM purchases p
             JOIN users u ON u.id = COALESCE(p.user_id, p.purchaser_id)
             WHERE p.status = 'completed'
               AND u.last_active_at >= p.created_at
               ${appWhere})                                                                   AS active_post_purchase`,
          appParam,
        ),

        // ── 4. Revenue cohort grid (last 6 signup months) ──────────────────
        harbourSql.query(`
          WITH user_cohorts AS (
            SELECT id,
                   DATE_TRUNC('month', created_at) AS cohort_month
            FROM users
            WHERE created_at >= NOW() - INTERVAL '7 months'
          ),
          first_purchase AS (
            SELECT COALESCE(p.user_id, p.purchaser_id) AS uid,
                   MIN(p.created_at) AS first_at
            FROM purchases p
            WHERE p.status = 'completed'
            GROUP BY COALESCE(p.user_id, p.purchaser_id)
          )
          SELECT
            TO_CHAR(uc.cohort_month, 'YYYY-MM') AS cohort,
            COUNT(*)::int                         AS cohort_size,
            COUNT(*) FILTER (
              WHERE fp.first_at IS NOT NULL
                AND fp.first_at < uc.cohort_month + INTERVAL '1 month'
            )::int                                AS by_m0,
            COUNT(*) FILTER (
              WHERE fp.first_at IS NOT NULL
                AND fp.first_at < uc.cohort_month + INTERVAL '2 months'
            )::int                                AS by_m1,
            COUNT(*) FILTER (
              WHERE fp.first_at IS NOT NULL
                AND fp.first_at < uc.cohort_month + INTERVAL '3 months'
            )::int                                AS by_m2,
            COUNT(*) FILTER (
              WHERE fp.first_at IS NOT NULL
                AND fp.first_at < uc.cohort_month + INTERVAL '4 months'
            )::int                                AS by_m3
          FROM user_cohorts uc
          LEFT JOIN first_purchase fp ON fp.uid = uc.id
          GROUP BY uc.cohort_month
          ORDER BY uc.cohort_month DESC
          LIMIT 6
        `),

        // ── 5. Player leaderboard (top 20 by total knots) ──────────────────
        // harbour_knots has no app column — always harbour-wide.
        harbourSql.query(`
          SELECT
            u.name,
            u.email,
            COALESCE(SUM(k.delta) FILTER (WHERE k.delta > 0), 0)::int    AS knots_earned,
            ABS(COALESCE(SUM(k.delta) FILTER (WHERE k.delta < 0), 0))::int AS knots_spent,
            COALESCE(SUM(k.delta), 0)::int                                AS knots_total,
            MAX(u.last_active_at)::text                                   AS last_active
          FROM users u
          JOIN harbour_knots k ON k.user_id = u.id
          GROUP BY u.id, u.name, u.email
          ORDER BY knots_total DESC
          LIMIT 20
        `),

        // ── 6. Access code campaign stats ───────────────────────────────────
        harbourSql.query(`
          SELECT
            ac.campaign,
            COUNT(DISTINCT ac.id)::int                                               AS total_codes,
            COUNT(DISTINCT ac.id) FILTER (
              WHERE ac.revoked_at IS NULL
                AND (ac.expires_at IS NULL OR ac.expires_at > NOW())
            )::int                                                                   AS active_codes,
            COUNT(DISTINCT acr.id)::int                                              AS total_redemptions,
            COUNT(DISTINCT acr.id) FILTER (
              WHERE acr.redeemed_at >= NOW() - INTERVAL '7 days'
            )::int                                                                   AS redemptions_this_week,
            COALESCE(
              COUNT(DISTINCT acr.user_id) FILTER (WHERE u.last_active_at > acr.redeemed_at)
              ::float / NULLIF(COUNT(DISTINCT acr.user_id), 0),
              0
            )                                                                        AS activation_rate
          FROM access_codes ac
          LEFT JOIN access_code_redemptions acr ON acr.code_id = ac.id
          LEFT JOIN users u ON u.id = acr.user_id
          GROUP BY ac.campaign
          ORDER BY total_redemptions DESC
        `),

        // ── 7. Daily redemptions — last 30 days ─────────────────────────────
        harbourSql.query(`
          SELECT
            DATE_TRUNC('day', acr.redeemed_at)::date::text AS day,
            ac.campaign,
            COUNT(*)::int AS count
          FROM access_code_redemptions acr
          JOIN access_codes ac ON ac.id = acr.code_id
          WHERE acr.redeemed_at >= NOW() - INTERVAL '30 days'
          GROUP BY day, ac.campaign
          ORDER BY day ASC
        `),

        // ── 8. Overall access code totals ───────────────────────────────────
        harbourSql.query(`
          SELECT
            (SELECT COUNT(*)::int FROM access_code_redemptions)                    AS total_redemptions,
            (SELECT COUNT(*)::int FROM access_codes
             WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) AS active_codes
        `),
      ]);

    const b = bucketsResult.rows[0] ?? {};
    const f = funnelResult.rows[0] ?? {};

    return {
      userStateBuckets: {
        new:         b.new           ?? 0,
        current:     b.current_users ?? 0,
        atRiskWau:   b.at_risk_wau   ?? 0,
        atRiskMau:   b.at_risk_mau   ?? 0,
        dormant:     b.dormant       ?? 0,
        neverActive: b.never_active  ?? 0,
        total:       b.total         ?? 0,
      },
      knotsActivity30d: knotsResult.rows.map((r) => ({
        date:   r.day,
        earned: r.earned ?? 0,
        spent:  r.spent  ?? 0,
      })),
      packFunnel: {
        totalUsers:          f.total_users          ?? 0,
        withEntitlement:     f.with_entitlement     ?? 0,
        withPaidEntitlement: f.with_paid_entitlement ?? 0,
        activePostPurchase:  f.active_post_purchase ?? 0,
      },
      revenueCohorts: cohortResult.rows.map((r) => {
        const size = r.cohort_size ?? 0;
        const pct = (n: number) => size > 0 ? Math.round((n / size) * 100) : 0;
        return {
          cohortMonth: r.cohort,
          cohortSize:  size,
          byMonth0:    pct(r.by_m0 ?? 0),
          byMonth1:    pct(r.by_m1 ?? 0),
          byMonth2:    pct(r.by_m2 ?? 0),
          byMonth3:    pct(r.by_m3 ?? 0),
        };
      }),
      playerLeaderboard: leaderboardResult.rows.map((r) => ({
        name:        r.name ?? null,
        email:       r.email,
        knotsEarned: r.knots_earned ?? 0,
        knotsSpent:  r.knots_spent  ?? 0,
        knotsTotal:  r.knots_total  ?? 0,
        lastActive:  r.last_active  ?? null,
      })),
      accessCodes: {
        byCampaign: codeStatsResult.rows.map((r) => ({
          campaign:              r.campaign,
          totalCodes:            r.total_codes            ?? 0,
          activeCodes:           r.active_codes           ?? 0,
          totalRedemptions:      r.total_redemptions      ?? 0,
          redemptionsThisWeek:   r.redemptions_this_week  ?? 0,
          activationRate:        Number(r.activation_rate ?? 0),
        })),
        dailyRedemptions30d: codeDailyResult.rows.map((r) => ({
          date:     r.day,
          campaign: r.campaign,
          count:    r.count ?? 0,
        })),
        totalRedemptionsAllTime: codeTotalsResult.rows[0]?.total_redemptions ?? 0,
        totalActiveCodes:        codeTotalsResult.rows[0]?.active_codes ?? 0,
      },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[harbour-observatory] query failed:", msg);
    return { ...EMPTY_OBSERVATORY, error: `neon query failed: ${msg}` };
  }
}
