/**
 * CampaignWeeklySummary — weekly pulse card on the campaigns page.
 *
 * Compares this week (last 7 days) vs last week (8–14 days ago) across:
 *   - emails sent
 *   - open rate
 *   - click rate
 *
 * Renders as a horizontal bar below CampaignStatsStrip, above the filters.
 * Streamed independently via Suspense so it never blocks the Kanban.
 */

import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import { queryCampaigns } from "@/lib/notion/campaigns";
import { TrendingUp, TrendingDown, Minus, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

// ── date helpers ──────────────────────────────────────────────

const MS_DAY = 86_400_000;

function weekBounds() {
  const now = Date.now();
  return {
    thisStart: now - 7 * MS_DAY,
    lastStart: now - 14 * MS_DAY,
    lastEnd: now - 7 * MS_DAY,
  };
}

function isoShort(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ── data ─────────────────────────────────────────────────────

async function fetchWeeklyStats() {
  const [{ data: drafts }, { data: campaigns }] = await Promise.all([
    queryEmailDrafts({ status: "sent" }, { pageSize: 500 }),
    queryCampaigns({ status: "active" }, { pageSize: 100 }),
  ]);

  const { thisStart, lastStart, lastEnd } = weekBounds();

  const thisWeek = drafts.filter((d) => {
    const ts = d.sentAt ? new Date(d.sentAt).getTime() : null;
    return ts !== null && ts >= thisStart;
  });
  const lastWeek = drafts.filter((d) => {
    const ts = d.sentAt ? new Date(d.sentAt).getTime() : null;
    return ts !== null && ts >= lastStart && ts < lastEnd;
  });

  function openRate(set: typeof drafts) {
    if (set.length === 0) return null;
    return Math.round((set.filter((d) => d.opens > 0).length / set.length) * 100);
  }
  function clickRate(set: typeof drafts) {
    if (set.length === 0) return null;
    return Math.round((set.filter((d) => d.clicks > 0).length / set.length) * 100);
  }

  const thisOpenRate = openRate(thisWeek);
  const lastOpenRate = openRate(lastWeek);
  const thisClickRate = clickRate(thisWeek);

  // campaigns active this week that sent at least one email
  const campaignsSendingThisWeek = new Set(
    thisWeek.map((d) => d.campaignId).filter(Boolean),
  ).size;

  return {
    thisStart,
    lastStart,
    lastEnd,
    thisWeekSent: thisWeek.length,
    lastWeekSent: lastWeek.length,
    sentDelta: thisWeek.length - lastWeek.length,
    thisOpenRate,
    lastOpenRate,
    openDelta: thisOpenRate !== null && lastOpenRate !== null ? thisOpenRate - lastOpenRate : null,
    thisClickRate,
    activeCampaigns: campaigns.length,
    campaignsSendingThisWeek,
  };
}

// ── delta pill ────────────────────────────────────────────────

function DeltaPill({ delta, suffix = "" }: { delta: number; suffix?: string }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
        <Minus className="h-2.5 w-2.5" /> same
      </span>
    );
  }
  const up = delta > 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${
        up ? "text-green-600" : "text-red-500"
      }`}
    >
      {up ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
      {up ? "+" : ""}
      {delta}
      {suffix}
    </span>
  );
}

// ── main component ────────────────────────────────────────────

export async function CampaignWeeklySummary() {
  const stats = await fetchWeeklyStats();

  // If no emails have been sent at all, skip the card
  if (stats.thisWeekSent === 0 && stats.lastWeekSent === 0) return null;

  const weekLabel = `${isoShort(stats.thisStart)} – today`;
  const lastLabel = `${isoShort(stats.lastStart)} – ${isoShort(stats.lastEnd)}`;

  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-xs font-medium text-foreground">this week</span>
        <span className="text-[10px] text-muted-foreground ml-0.5">({weekLabel})</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* emails sent */}
        <div className="space-y-0.5">
          <div className="text-2xl font-bold tabular-nums">{stats.thisWeekSent}</div>
          <div className="text-[11px] text-muted-foreground">emails sent</div>
          <DeltaPill delta={stats.sentDelta} />
          <div className="text-[10px] text-muted-foreground/60">{stats.lastWeekSent} last week</div>
        </div>

        {/* open rate */}
        <div className="space-y-0.5">
          {stats.thisOpenRate !== null ? (
            <>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  stats.thisOpenRate >= 30
                    ? "text-green-600"
                    : stats.thisOpenRate >= 15
                    ? "text-amber-600"
                    : "text-foreground"
                }`}
              >
                {stats.thisOpenRate}%
              </div>
              <div className="text-[11px] text-muted-foreground">open rate</div>
              {stats.openDelta !== null && <DeltaPill delta={stats.openDelta} suffix="pp" />}
              {stats.lastOpenRate !== null && (
                <div className="text-[10px] text-muted-foreground/60">{stats.lastOpenRate}% last week</div>
              )}
            </>
          ) : (
            <div className="text-2xl font-bold text-muted-foreground">—</div>
          )}
          {stats.thisOpenRate === null && (
            <div className="text-[11px] text-muted-foreground">open rate</div>
          )}
        </div>

        {/* click rate */}
        <div className="space-y-0.5">
          {stats.thisClickRate !== null ? (
            <>
              <div
                className={`text-2xl font-bold tabular-nums ${
                  stats.thisClickRate >= 5
                    ? "text-green-600"
                    : stats.thisClickRate >= 2
                    ? "text-amber-600"
                    : "text-foreground"
                }`}
              >
                {stats.thisClickRate}%
              </div>
              <div className="text-[11px] text-muted-foreground">click rate</div>
              <div className="text-[10px] text-muted-foreground/60">{stats.thisWeekSent} sent</div>
            </>
          ) : (
            <>
              <div className="text-2xl font-bold text-muted-foreground">—</div>
              <div className="text-[11px] text-muted-foreground">click rate</div>
            </>
          )}
        </div>

        {/* campaign activity */}
        <div className="space-y-0.5">
          <div className="text-2xl font-bold tabular-nums">{stats.campaignsSendingThisWeek}</div>
          <div className="text-[11px] text-muted-foreground">campaigns active</div>
          <div className="text-[10px] text-muted-foreground/60">
            {stats.activeCampaigns} total active
          </div>
        </div>
      </div>
    </div>
  );
}

export function CampaignWeeklySummarySkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 mb-4">
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-3.5 w-3.5 rounded" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-8 w-12 rounded" />
            <Skeleton className="h-2.5 w-16 rounded" />
            <Skeleton className="h-2.5 w-10 rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
