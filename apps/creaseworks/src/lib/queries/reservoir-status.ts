/**
 * Reservoir status queries — cross-platform health dashboard.
 *
 * Admin-only. No visibility scoping — shows the full picture across
 * all reservoir apps: creaseworks, deep-deck, vertigo-vault.
 */

import { sql } from "@/lib/db";

/* ------------------------------------------------------------------ */
/*  types                                                              */
/* ------------------------------------------------------------------ */

export interface ContentCounts {
  playdates: number;
  materials: number;
  vaultActivities: number;
  packs: number;
  cmsPages: number;
  collections: number;
}

export interface UserStats {
  totalUsers: number;
  totalOrgs: number;
  activeUsersThisMonth: number;
  activeUsersLastMonth: number;
  signupsThisMonth: number;
}

export interface EntitlementStats {
  activeEntitlements: number;
  orgEntitlements: number;
  userEntitlements: number;
  totalPurchases: number;
  revenueThisMonth: number;
}

export interface RunStats {
  totalRuns: number;
  runsThisMonth: number;
  runsLastMonth: number;
  uniqueReflectors: number;
  avgRunsPerUser: number;
}

export interface ContentFreshness {
  table: string;
  rowCount: number;
  lastUpdated: string | null;
}

export interface TopItem {
  name: string;
  count: number;
}

export interface RevenueStats {
  totalRevenueCents: number;
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  avgOrderCents: number;
  purchasesByPack: { name: string; count: number; revenueCents: number }[];
  revenueTrend: { month: string; revenueCents: number; count: number }[];
  recentPurchases: {
    pack: string;
    amountCents: number;
    currency: string;
    createdAt: string;
  }[];
}

export interface DeploymentInfo {
  app: string;
  state: string;
  url: string;
  createdAt: number;
  commitMessage: string;
  commitRef: string;
}

export interface ReservoirStatus {
  content: ContentCounts;
  users: UserStats;
  entitlements: EntitlementStats;
  runs: RunStats;
  freshness: ContentFreshness[];
  topPlaydates: TopItem[];
  topVaultActivities: TopItem[];
  recentSignups: { month: string; count: number }[];
  revenue: RevenueStats;
  deployments: DeploymentInfo[];
}

/* ------------------------------------------------------------------ */
/*  main query                                                         */
/* ------------------------------------------------------------------ */

export async function getReservoirStatus(): Promise<ReservoirStatus> {
  // Run independent queries in parallel for speed
  const [
    contentResult,
    usersResult,
    entitlementsResult,
    runsResult,
    freshnessResult,
    topPlaydatesResult,
    topVaultResult,
    signupTrendResult,
    revenueResult,
    deploymentsResult,
  ] = await Promise.all([
    queryContentCounts(),
    queryUserStats(),
    queryEntitlementStats(),
    queryRunStats(),
    queryContentFreshness(),
    queryTopPlaydates(),
    queryTopVaultActivities(),
    querySignupTrend(),
    queryRevenue(),
    queryDeployments(),
  ]);

  return {
    content: contentResult,
    users: usersResult,
    entitlements: entitlementsResult,
    runs: runsResult,
    freshness: freshnessResult,
    topPlaydates: topPlaydatesResult,
    topVaultActivities: topVaultResult,
    recentSignups: signupTrendResult,
    revenue: revenueResult,
    deployments: deploymentsResult,
  };
}

/* ------------------------------------------------------------------ */
/*  individual queries                                                 */
/* ------------------------------------------------------------------ */

async function queryContentCounts(): Promise<ContentCounts> {
  const r = await sql.query(`
    SELECT
      (SELECT COUNT(*)::int FROM playdates_cache) AS playdates,
      (SELECT COUNT(*)::int FROM materials_cache) AS materials,
      (SELECT COUNT(*)::int FROM vault_activities_cache) AS vault_activities,
      (SELECT COUNT(*)::int FROM packs_catalogue) AS packs,
      (SELECT COUNT(*)::int FROM cms_pages) AS cms_pages,
      (SELECT COUNT(*)::int FROM collections) AS collections
  `);
  const row = r.rows[0];
  return {
    playdates: row?.playdates ?? 0,
    materials: row?.materials ?? 0,
    vaultActivities: row?.vault_activities ?? 0,
    packs: row?.packs ?? 0,
    cmsPages: row?.cms_pages ?? 0,
    collections: row?.collections ?? 0,
  };
}

async function queryUserStats(): Promise<UserStats> {
  const r = await sql.query(`
    SELECT
      (SELECT COUNT(*)::int FROM users) AS total_users,
      (SELECT COUNT(*)::int FROM organisations) AS total_orgs,
      (SELECT COUNT(*)::int FROM users
       WHERE last_active_at >= DATE_TRUNC('month', CURRENT_DATE)
          OR created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS active_this_month,
      (SELECT COUNT(*)::int FROM users
       WHERE last_active_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
         AND last_active_at < DATE_TRUNC('month', CURRENT_DATE)) AS active_last_month,
      (SELECT COUNT(*)::int FROM users
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS signups_this_month
  `);
  const row = r.rows[0];
  return {
    totalUsers: row?.total_users ?? 0,
    totalOrgs: row?.total_orgs ?? 0,
    activeUsersThisMonth: row?.active_this_month ?? 0,
    activeUsersLastMonth: row?.active_last_month ?? 0,
    signupsThisMonth: row?.signups_this_month ?? 0,
  };
}

async function queryEntitlementStats(): Promise<EntitlementStats> {
  const r = await sql.query(`
    SELECT
      (SELECT COUNT(*)::int FROM entitlements
       WHERE revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())) AS active,
      (SELECT COUNT(*)::int FROM entitlements
       WHERE revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
         AND org_id IS NOT NULL) AS org_ent,
      (SELECT COUNT(*)::int FROM entitlements
       WHERE revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())
         AND org_id IS NULL AND user_id IS NOT NULL) AS user_ent,
      (SELECT COUNT(*)::int FROM purchases) AS total_purchases,
      (SELECT COUNT(*)::int FROM purchases
       WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) AS purchases_this_month
  `);
  const row = r.rows[0];
  return {
    activeEntitlements: row?.active ?? 0,
    orgEntitlements: row?.org_ent ?? 0,
    userEntitlements: row?.user_ent ?? 0,
    totalPurchases: row?.total_purchases ?? 0,
    revenueThisMonth: row?.purchases_this_month ?? 0,
  };
}

async function queryRunStats(): Promise<RunStats> {
  const r = await sql.query(`
    SELECT
      (SELECT COUNT(*)::int FROM runs_cache) AS total,
      (SELECT COUNT(*)::int FROM runs_cache
       WHERE run_date IS NOT NULL
         AND run_date::date >= DATE_TRUNC('month', CURRENT_DATE)) AS this_month,
      (SELECT COUNT(*)::int FROM runs_cache
       WHERE run_date IS NOT NULL
         AND run_date::date >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
         AND run_date::date < DATE_TRUNC('month', CURRENT_DATE)) AS last_month,
      (SELECT COUNT(DISTINCT created_by)::int FROM runs_cache) AS unique_reflectors,
      COALESCE(
        (SELECT ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT created_by), 0), 1)
         FROM runs_cache),
        0
      )::float AS avg_per_user
  `);
  const row = r.rows[0];
  return {
    totalRuns: row?.total ?? 0,
    runsThisMonth: row?.this_month ?? 0,
    runsLastMonth: row?.last_month ?? 0,
    uniqueReflectors: row?.unique_reflectors ?? 0,
    avgRunsPerUser: row?.avg_per_user ?? 0,
  };
}

async function queryContentFreshness(): Promise<ContentFreshness[]> {
  // Check last-updated timestamps across synced content tables.
  // Each table has a synced_at or updated_at column from the Notion sync.
  const tables: { name: string; countQuery: string; dateQuery: string }[] = [
    {
      name: "playdates",
      countQuery: "SELECT COUNT(*)::int AS c FROM playdates_cache",
      dateQuery: "SELECT MAX(synced_at)::text AS d FROM playdates_cache",
    },
    {
      name: "materials",
      countQuery: "SELECT COUNT(*)::int AS c FROM materials_cache",
      dateQuery: "SELECT MAX(synced_at)::text AS d FROM materials_cache",
    },
    {
      name: "vault activities",
      countQuery: "SELECT COUNT(*)::int AS c FROM vault_activities_cache",
      dateQuery: "SELECT MAX(synced_at)::text AS d FROM vault_activities_cache",
    },
    {
      name: "packs",
      countQuery: "SELECT COUNT(*)::int AS c FROM packs_catalogue",
      dateQuery: "SELECT MAX(synced_at)::text AS d FROM packs_catalogue",
    },
  ];

  const results: ContentFreshness[] = [];
  for (const t of tables) {
    try {
      const [countRes, dateRes] = await Promise.all([
        sql.query(t.countQuery),
        sql.query(t.dateQuery),
      ]);
      results.push({
        table: t.name,
        rowCount: countRes.rows[0]?.c ?? 0,
        lastUpdated: dateRes.rows[0]?.d ?? null,
      });
    } catch {
      // Table may not exist yet (e.g. vault migration not applied)
      results.push({ table: t.name, rowCount: 0, lastUpdated: null });
    }
  }
  return results;
}

async function queryTopPlaydates(): Promise<TopItem[]> {
  const r = await sql.query(`
    SELECT p.title AS name, COUNT(*)::int AS count
    FROM runs_cache r
    JOIN playdates_cache p ON p.notion_id = r.playdate_notion_id
    WHERE r.playdate_notion_id IS NOT NULL
    GROUP BY p.title
    ORDER BY count DESC
    LIMIT 5
  `);
  return r.rows;
}

async function queryTopVaultActivities(): Promise<TopItem[]> {
  try {
    const r = await sql.query(`
      SELECT name, 0 AS count
      FROM vault_activities_cache
      ORDER BY name ASC
      LIMIT 5
    `);
    return r.rows;
  } catch {
    // Table may not exist yet
    return [];
  }
}

async function querySignupTrend(): Promise<{ month: string; count: number }[]> {
  const r = await sql.query(`
    SELECT TO_CHAR(created_at, 'YYYY-MM') AS month,
           COUNT(*)::int AS count
    FROM users
    WHERE created_at >= (CURRENT_DATE - INTERVAL '6 months')
    GROUP BY month
    ORDER BY month ASC
  `);
  return r.rows;
}

/* ------------------------------------------------------------------ */
/*  revenue queries                                                    */
/* ------------------------------------------------------------------ */

async function queryRevenue(): Promise<RevenueStats> {
  try {
    const [totalsRes, byPackRes, trendRes, recentRes] = await Promise.all([
      sql.query(`
        SELECT
          COALESCE(SUM(amount_cents), 0)::int AS total,
          COALESCE(SUM(amount_cents) FILTER (
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
          ), 0)::int AS this_month,
          COALESCE(SUM(amount_cents) FILTER (
            WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month'
              AND created_at < DATE_TRUNC('month', CURRENT_DATE)
          ), 0)::int AS last_month,
          COALESCE(AVG(amount_cents), 0)::int AS avg_order,
          COUNT(*)::int AS total_count
        FROM purchases
        WHERE status = 'completed'
      `),
      sql.query(`
        SELECT
          COALESCE(pc.name, 'unknown') AS name,
          COUNT(*)::int AS count,
          COALESCE(SUM(p.amount_cents), 0)::int AS revenue_cents
        FROM purchases p
        LEFT JOIN packs_catalogue pc ON pc.id = p.pack_catalogue_id
        WHERE p.status = 'completed'
        GROUP BY pc.name
        ORDER BY revenue_cents DESC
        LIMIT 10
      `),
      sql.query(`
        SELECT
          TO_CHAR(created_at, 'YYYY-MM') AS month,
          COALESCE(SUM(amount_cents), 0)::int AS revenue_cents,
          COUNT(*)::int AS count
        FROM purchases
        WHERE status = 'completed'
          AND created_at >= (CURRENT_DATE - INTERVAL '6 months')
        GROUP BY month
        ORDER BY month ASC
      `),
      sql.query(`
        SELECT
          COALESCE(pc.name, 'unknown') AS pack,
          p.amount_cents,
          p.currency,
          p.created_at::text AS created_at
        FROM purchases p
        LEFT JOIN packs_catalogue pc ON pc.id = p.pack_catalogue_id
        WHERE p.status = 'completed'
        ORDER BY p.created_at DESC
        LIMIT 5
      `),
    ]);

    const totals = totalsRes.rows[0];
    return {
      totalRevenueCents: totals?.total ?? 0,
      revenueThisMonthCents: totals?.this_month ?? 0,
      revenueLastMonthCents: totals?.last_month ?? 0,
      avgOrderCents: totals?.avg_order ?? 0,
      purchasesByPack: byPackRes.rows.map((r: any) => ({
        name: r.name,
        count: r.count,
        revenueCents: r.revenue_cents,
      })),
      revenueTrend: trendRes.rows.map((r: any) => ({
        month: r.month,
        revenueCents: r.revenue_cents,
        count: r.count,
      })),
      recentPurchases: recentRes.rows.map((r: any) => ({
        pack: r.pack,
        amountCents: r.amount_cents,
        currency: r.currency,
        createdAt: r.created_at,
      })),
    };
  } catch {
    // purchases table may not exist in some environments
    return {
      totalRevenueCents: 0,
      revenueThisMonthCents: 0,
      revenueLastMonthCents: 0,
      avgOrderCents: 0,
      purchasesByPack: [],
      revenueTrend: [],
      recentPurchases: [],
    };
  }
}

/* ------------------------------------------------------------------ */
/*  deployment queries (Vercel REST API)                               */
/* ------------------------------------------------------------------ */

const VERCEL_APPS: { name: string; projectId: string }[] = [
  { name: "site", projectId: "prj_k02f1LutCsQLZEDIyM2xYJ1PGPCx" },
  { name: "reservoir", projectId: "prj_KqjKxyhlGTublMolccOkvLFBZ8Xn" },
  { name: "creaseworks", projectId: "prj_EoDpRvw1kdAqcGVrcaYclfWFeX7b" },
  { name: "deep-deck", projectId: "prj_Z2zpJXnsOrVp5hyoJ89ERuQHmOru" },
  { name: "vertigo-vault", projectId: "prj_KHsZ60sQpj3ipSB5lzy9CGVAUYaW" },
  { name: "nordic-sqr-rct", projectId: "prj_laAl3qm5w20CrtIjO2klc9dj180z" },
];

const VERCEL_TEAM_ID = "team_wrpRda7ZzXdu7nKcEVVXY3th";

async function queryDeployments(): Promise<DeploymentInfo[]> {
  const token = process.env.VERCEL_ACCESS_TOKEN;
  if (!token) return [];

  const results: DeploymentInfo[] = [];

  // Fetch latest production deployment for each app in parallel
  const fetches = VERCEL_APPS.map(async (app) => {
    try {
      const url = `https://api.vercel.com/v6/deployments?projectId=${app.projectId}&teamId=${VERCEL_TEAM_ID}&limit=1&target=production`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const d = data.deployments?.[0];
      if (!d) return null;
      return {
        app: app.name,
        state: d.state ?? "UNKNOWN",
        url: d.url ?? "",
        createdAt: d.created ?? 0,
        commitMessage: (d.meta?.githubCommitMessage ?? "").slice(0, 80),
        commitRef: d.meta?.githubCommitRef ?? "",
      };
    } catch {
      return null;
    }
  });

  const settled = await Promise.all(fetches);
  for (const d of settled) {
    if (d) results.push(d);
  }
  return results;
}
