/**
 * /analytics — port usage dashboard.
 *
 * Shows who is using the port, which pages they visit, and how active they are.
 * Data source: port_usage_events Supabase table (written by PageViewLogger).
 */

import { BarChart2 } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { getPortAnalyticsSummary } from "@/lib/supabase/analytics";

export const dynamic = "force-dynamic";

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold mt-1 tabular-nums">{value}</p>
    </div>
  );
}

function ActivityBar({ count, max, date }: { count: number; max: number; date: string }) {
  const pct = max > 0 ? Math.max(4, Math.round((count / max) * 80)) : 4;
  const label = date.slice(5); // MM-DD
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <span className="text-[10px] text-muted-foreground tabular-nums">{count > 0 ? count : ""}</span>
      <div className="w-full flex items-end" style={{ height: 80 }}>
        <div
          className="w-full rounded-t-sm bg-primary/70"
          style={{ height: pct }}
        />
      </div>
      <span className="text-[9px] text-muted-foreground">{label}</span>
    </div>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function nameFromEmail(email: string) {
  return email.split("@")[0].replace(/\./g, " ");
}

export default async function AnalyticsPage() {
  let data;
  try {
    data = await getPortAnalyticsSummary(30);
  } catch (err) {
    return (
      <div>
        <PageHeader
          title="analytics"
          description="port usage — who's here and what they're doing"
        />
        <p className="text-sm text-destructive">
          failed to load analytics: {err instanceof Error ? err.message : String(err)}
        </p>
      </div>
    );
  }

  const maxDaily = Math.max(...data.dailyActivity.map((d) => d.count), 1);

  return (
    <div className="space-y-8">
      <PageHeader
        title="analytics"
        description="port usage — last 30 days"
      />

      {/* hero stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="page views" value={data.totalViews.toLocaleString()} />
        <StatCard label="unique users" value={data.uniqueUsers} />
        <StatCard label="active today" value={data.activeToday} />
      </div>

      {/* daily activity chart */}
      {data.dailyActivity.length > 0 ? (
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm font-medium mb-4">daily activity</p>
          <div className="flex items-end gap-1">
            {data.dailyActivity.map((d) => (
              <ActivityBar key={d.date} count={Number(d.count)} max={maxDaily} date={d.date} />
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          no activity recorded yet — navigate around the port to start tracking
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* top pages */}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm font-medium mb-3">top pages</p>
          {data.topPaths.length === 0 ? (
            <p className="text-sm text-muted-foreground">no data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium text-muted-foreground pb-2">path</th>
                  <th className="text-right font-medium text-muted-foreground pb-2">views</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.topPaths.map((p) => (
                  <tr key={p.path}>
                    <td className="py-1.5 font-mono text-xs">{p.path}</td>
                    <td className="py-1.5 text-right tabular-nums">{Number(p.count).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* per-user breakdown */}
        <div className="rounded-lg border bg-card p-5">
          <p className="text-sm font-medium mb-3">users</p>
          {data.perUser.length === 0 ? (
            <p className="text-sm text-muted-foreground">no data yet</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left font-medium text-muted-foreground pb-2">user</th>
                  <th className="text-right font-medium text-muted-foreground pb-2">views</th>
                  <th className="text-right font-medium text-muted-foreground pb-2">last seen</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.perUser.map((u) => (
                  <tr key={u.user_email}>
                    <td className="py-1.5">
                      <span className="capitalize">{nameFromEmail(u.user_email)}</span>
                      <span className="block text-xs text-muted-foreground">{u.user_email}</span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums">{Number(u.count).toLocaleString()}</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground">{formatDate(u.last_seen)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
