/**
 * Aggregate campaign stats strip — shown at the top of the campaigns page.
 *
 * Pulls all sent EmailDraft records and all campaigns to compute:
 *   total sends · avg open rate · avg click rate · active campaigns
 *
 * Rendered as an async server component inside a Suspense boundary so it
 * streams in independently without blocking the campaign Kanban below it.
 */

import { queryCampaigns } from "@/lib/notion/campaigns";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";

async function fetchStats() {
  const [{ data: campaigns }, { data: drafts }] = await Promise.all([
    queryCampaigns(undefined, { pageSize: 100 }),
    queryEmailDrafts({ status: "sent" }, { pageSize: 500 }),
  ]);

  const activeCampaigns = campaigns.filter((c) => c.status === "active").length;

  const totalSent = drafts.length;
  const totalOpened = drafts.filter((d) => d.opens > 0).length;
  const totalClicked = drafts.filter((d) => d.clicks > 0).length;
  const totalMachineOpens = drafts.reduce((s, d) => s + (d.machineOpens ?? 0), 0);

  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const clickRate = totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0;

  return { totalSent, openRate, clickRate, activeCampaigns, totalCampaigns: campaigns.length, totalMachineOpens };
}

const stats = [
  {
    key: "activeCampaigns" as const,
    label: "active",
    format: (v: number, s: Awaited<ReturnType<typeof fetchStats>>) =>
      `${v} / ${s.totalCampaigns}`,
  },
  { key: "totalSent" as const, label: "emails sent", format: (v: number) => v.toLocaleString() },
  {
    key: "openRate" as const,
    label: "avg open rate",
    format: (v: number, s: Awaited<ReturnType<typeof fetchStats>>) =>
      s.totalMachineOpens > 0 ? `${v}% (human)` : `${v}%`,
    highlight: (v: number) => (v >= 30 ? "text-green-600" : v >= 15 ? "text-amber-600" : "text-muted-foreground"),
  },
  {
    key: "clickRate" as const,
    label: "avg click rate",
    format: (v: number) => `${v}%`,
    highlight: (v: number) => (v >= 5 ? "text-green-600" : v >= 2 ? "text-amber-600" : "text-muted-foreground"),
  },
];

export async function CampaignStatsStrip() {
  const data = await fetchStats();

  if (data.totalSent === 0 && data.totalCampaigns === 0) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {stats.map(({ key, label, format, highlight }) => {
        const value = data[key];
        const colorClass = highlight ? highlight(value) : "text-foreground";
        return (
          <div
            key={key}
            className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-0.5"
          >
            <span className={`text-xl font-bold tabular-nums ${colorClass}`}>
              {format(value, data)}
            </span>
            <span className="text-[11px] text-muted-foreground">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function CampaignStatsStripSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-card px-4 py-3 h-[62px] animate-pulse bg-muted"
        />
      ))}
    </div>
  );
}
