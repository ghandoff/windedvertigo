/**
 * Command-tab queries — operational signals for the harbour fleet view.
 *
 * These feed the real-time command tab: North Stars (weekly revenue +
 * weekly active users), DAM/WAM/MAM ratios, and per-app commerce signals.
 *
 * All data is harbour-wide aggregates or per-app commerce (no L1 web events).
 * Session-level signals require the Analytics Engine wiring (Phase 2).
 */

import { harbourSql, isNeonConfigured } from "./client";

// ── types ─────────────────────────────────────────────────────────────────────

export interface NorthStars {
  /** Revenue from completed purchases in the past 7 days (cents). */
  weeklyRevenueCents: number;
  /** Revenue delta vs prior 7-day window (cents, can be negative). */
  weeklyRevenueDeltaCents: number;
  /** Users with last_active_at in the past 7 days. */
  weeklyActiveUsers: number;
  /** Weekly active delta vs prior 7-day window. */
  weeklyActiveUsersDelta: number;
}

export interface ActivityRatios {
  totalUsers: number;
  dailyActiveUsers: number;   // last_active_at >= today
  weeklyActiveUsers: number;  // last_active_at >= 7 days ago
  monthlyActiveUsers: number; // last_active_at >= 30 days ago
  /** DAM / MAM ratio (0–1). Healthy target ≥ 0.20. */
  damRatio: number;
  /** WAM / MAM ratio (0–1). Healthy target ≥ 0.50. */
  wamRatio: number;
}

export interface AppFleetRow {
  app: string;
  activeEntitlements: number;
  totalPurchases: number;
  purchasesThisWeek: number;
  revenueThisWeekCents: number;
  revenueThisMonthCents: number;
}

export interface CommandMetrics {
  northStars: NorthStars;
  ratios: ActivityRatios;
  fleet: AppFleetRow[];
  /** Active (not revoked, not expired) code count. */
  activeCampaignCodes: number;
  /** Redemptions in the past 7 days across all campaigns. */
  codeRedemptionsThisWeek: number;
  unavailable?: boolean;
  error?: string;
}

const EMPTY_COMMAND: CommandMetrics = {
  activeCampaignCodes: 0,
  codeRedemptionsThisWeek: 0,
  unavailable: true,
  error: undefined,
  northStars: {
    weeklyRevenueCents: 0,
    weeklyRevenueDeltaCents: 0,
    weeklyActiveUsers: 0,
    weeklyActiveUsersDelta: 0,
  },
  ratios: {
    totalUsers: 0,
    dailyActiveUsers: 0,
    weeklyActiveUsers: 0,
    monthlyActiveUsers: 0,
    damRatio: 0,
    wamRatio: 0,
  },
  fleet: [],
};

// ── main query ────────────────────────────────────────────────────────────────

export async function getCommandMetrics(): Promise<CommandMetrics> {
  if (!isNeonConfigured()) {
    return { ...EMPTY_COMMAND, error: "POSTGRES_URL is not set in the CF Worker environment" };
  }

  try {
    const [summaryResult, fleetEntitlements, fleetPurchases, codeResult] = await Promise.all([
      // North Stars + activity ratios (single round-trip)
      harbourSql.query(`
        SELECT
          -- North Stars (this week vs prior week)
          (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM purchases
           WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '7 days') AS rev_this_week,
          (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM purchases
           WHERE status = 'completed'
             AND created_at >= NOW() - INTERVAL '14 days'
             AND created_at <  NOW() - INTERVAL '7 days')                          AS rev_prior_week,
          (SELECT COUNT(*)::int FROM users
           WHERE last_active_at >= NOW() - INTERVAL '7 days')                      AS wau_this,
          (SELECT COUNT(*)::int FROM users
           WHERE last_active_at >= NOW() - INTERVAL '14 days'
             AND last_active_at <  NOW() - INTERVAL '7 days')                      AS wau_prior,
          -- Activity ratios
          (SELECT COUNT(*)::int FROM users)                                         AS total_users,
          (SELECT COUNT(*)::int FROM users WHERE last_active_at >= CURRENT_DATE)   AS dam,
          (SELECT COUNT(*)::int FROM users WHERE last_active_at >= NOW() - INTERVAL '7 days')  AS wam,
          (SELECT COUNT(*)::int FROM users WHERE last_active_at >= NOW() - INTERVAL '30 days') AS mam
      `),

      // Per-app active entitlements
      harbourSql.query(`
        SELECT pcat.app, COUNT(*)::int AS active_entitlements
        FROM entitlements e
        JOIN packs_catalogue pcat ON pcat.pack_cache_id = e.pack_cache_id
        WHERE e.revoked_at IS NULL
          AND (e.expires_at IS NULL OR e.expires_at > NOW())
        GROUP BY pcat.app
        ORDER BY active_entitlements DESC
      `),

      // Per-app purchase signals
      harbourSql.query(`
        SELECT
          app,
          COUNT(*)::int                                                                  AS total_purchases,
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')::int          AS purchases_this_week,
          COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days'), 0)::bigint   AS rev_this_week_cents,
          COALESCE(SUM(amount_cents) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days'), 0)::bigint  AS rev_this_month_cents
        FROM purchases
        WHERE status = 'completed'
        GROUP BY app
        ORDER BY rev_this_month_cents DESC
      `),

      // Access code summary
      harbourSql.query(`
        SELECT
          (SELECT COUNT(*)::int FROM access_codes
           WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > NOW())) AS active_codes,
          (SELECT COUNT(*)::int FROM access_code_redemptions
           WHERE redeemed_at >= NOW() - INTERVAL '7 days') AS redeemed_this_week
      `),
    ]);

    const s = summaryResult.rows[0] ?? {};

    // Merge entitlements + purchases by app
    const entMap = new Map<string, number>();
    for (const r of fleetEntitlements.rows) {
      entMap.set(r.app, r.active_entitlements ?? 0);
    }

    const fleet: AppFleetRow[] = fleetPurchases.rows.map((r) => ({
      app: r.app,
      activeEntitlements: entMap.get(r.app) ?? 0,
      totalPurchases: r.total_purchases ?? 0,
      purchasesThisWeek: r.purchases_this_week ?? 0,
      revenueThisWeekCents: Number(r.rev_this_week_cents ?? 0),
      revenueThisMonthCents: Number(r.rev_this_month_cents ?? 0),
    }));

    // Include apps with entitlements but no purchases
    for (const [app, ent] of entMap) {
      if (!fleet.find((f) => f.app === app)) {
        fleet.push({
          app,
          activeEntitlements: ent,
          totalPurchases: 0,
          purchasesThisWeek: 0,
          revenueThisWeekCents: 0,
          revenueThisMonthCents: 0,
        });
      }
    }

    const mam = s.mam ?? 0;

    return {
      northStars: {
        weeklyRevenueCents: Number(s.rev_this_week ?? 0),
        weeklyRevenueDeltaCents: Number(s.rev_this_week ?? 0) - Number(s.rev_prior_week ?? 0),
        weeklyActiveUsers: s.wau_this ?? 0,
        weeklyActiveUsersDelta: (s.wau_this ?? 0) - (s.wau_prior ?? 0),
      },
      ratios: {
        totalUsers: s.total_users ?? 0,
        dailyActiveUsers: s.dam ?? 0,
        weeklyActiveUsers: s.wam ?? 0,
        monthlyActiveUsers: mam,
        damRatio: mam > 0 ? (s.dam ?? 0) / mam : 0,
        wamRatio: mam > 0 ? (s.wam ?? 0) / mam : 0,
      },
      fleet,
      activeCampaignCodes:      codeResult.rows[0]?.active_codes         ?? 0,
      codeRedemptionsThisWeek:  codeResult.rows[0]?.redeemed_this_week   ?? 0,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[harbour-command] query failed:", msg);
    return { ...EMPTY_COMMAND, error: `neon query failed: ${msg}` };
  }
}
