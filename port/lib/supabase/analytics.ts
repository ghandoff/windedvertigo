import { supabase } from "./client";

export interface PortDailyActivity {
  date: string; // YYYY-MM-DD
  count: number;
}

export interface PortPathStat {
  path: string;
  count: number;
}

export interface PortUserStat {
  user_email: string;
  count: number;
  last_seen: string; // ISO timestamp
}

export interface PortAnalyticsSummary {
  totalViews: number;
  uniqueUsers: number;
  activeToday: number;
  dailyActivity: PortDailyActivity[];
  topPaths: PortPathStat[];
  perUser: PortUserStat[];
}

export async function getPortAnalyticsSummary(days = 30): Promise<PortAnalyticsSummary> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const sinceIso = since.toISOString();
  const todayIso = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

  const [totalRes, todayRes, pathsRes, usersRes, dailyRes] = await Promise.all([
    // total views in window
    supabase
      .from("port_usage_events")
      .select("id", { count: "exact", head: true })
      .gte("visited_at", sinceIso),

    // active today (distinct users)
    supabase
      .from("port_usage_events")
      .select("user_email")
      .gte("visited_at", todayIso),

    // top paths
    supabase.rpc("port_analytics_top_paths", { since_ts: sinceIso, limit_n: 20 }),

    // per-user breakdown
    supabase.rpc("port_analytics_per_user", { since_ts: sinceIso }),

    // daily activity
    supabase.rpc("port_analytics_daily", { since_ts: sinceIso }),
  ]);

  const todayUsers = new Set((todayRes.data ?? []).map((r: { user_email: string }) => r.user_email));

  return {
    totalViews: totalRes.count ?? 0,
    uniqueUsers: (usersRes.data ?? []).length,
    activeToday: todayUsers.size,
    dailyActivity: (dailyRes.data ?? []) as PortDailyActivity[],
    topPaths: (pathsRes.data ?? []) as PortPathStat[],
    perUser: (usersRes.data ?? []) as PortUserStat[],
  };
}
