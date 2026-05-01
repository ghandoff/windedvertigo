/**
 * /analytics — Sequence Performance Analytics Dashboard
 *
 * Server component that fetches data directly from Notion (no fetch()).
 * Displays:
 *   - Stats strip (emails sent, open rate, click rate, total campaigns)
 *   - Campaign status breakdown
 *   - Monthly trend (CSS bar chart — recharts not installed)
 *
 * Moved from /settings/analytics in the settings refactor (Phase 11).
 * Old path redirects to here via next.config.ts.
 */

import Link from "next/link";
import { queryCampaigns } from "@/lib/notion/campaigns";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import { queryOrganizations } from "@/lib/notion/organizations";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { PageHeader } from "@/app/components/page-header";
import type { Campaign, EmailDraft, RfpOpportunity } from "@/lib/notion/types";

export const revalidate = 300;

// ── data helpers ──────────────────────────────────────────────────────────────

function toMonthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

function buildLastSixMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }));
  }
  return months;
}

const ACTIVE_STATUSES = new Set(["radar", "reviewing", "pursuing", "interviewing", "submitted"]);
const COMPLETED_STATUSES = new Set(["won", "lost", "no-go", "missed deadline"]);
const WIN_DENOM_STATUSES = new Set(["won", "lost", "no-go"]);

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

async function fetchRfpAnalytics() {
  const { data: rfps } = await queryRfpOpportunities(undefined, { pageSize: 200 });

  const active = rfps.filter((r: RfpOpportunity) => ACTIVE_STATUSES.has(r.status));
  const completed = rfps.filter((r: RfpOpportunity) => COMPLETED_STATUSES.has(r.status));
  const won = rfps.filter((r: RfpOpportunity) => r.status === "won");
  const lost = rfps.filter((r: RfpOpportunity) => r.status === "lost");
  const noGo = rfps.filter((r: RfpOpportunity) => r.status === "no-go");

  const totalActive = active.length;
  const totalPipelineValue = active.reduce((sum: number, r: RfpOpportunity) => sum + (r.estimatedValue ?? 0), 0);
  const totalWon = won.length;
  const totalLost = lost.length;
  const winDenomCount = won.length + lost.length + noGo.length;
  const winRate = winDenomCount > 0 ? Math.round((won.length / winDenomCount) * 100) : 0;
  const wonValue = won.reduce((sum: number, r: RfpOpportunity) => sum + (r.estimatedValue ?? 0), 0);

  // conversion by source
  const sourceMap = new Map<string, { total: number; won: number }>();
  for (const r of rfps) {
    const src = r.source ?? "Unknown";
    if (!sourceMap.has(src)) sourceMap.set(src, { total: 0, won: 0 });
    const entry = sourceMap.get(src)!;
    entry.total += 1;
    if (r.status === "won") entry.won += 1;
  }
  const bySource = Array.from(sourceMap.entries())
    .filter(([, v]) => v.total > 0)
    .map(([source, v]) => ({
      source,
      total: v.total,
      won: v.won,
      rate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // conversion by fit score
  const fitMap = new Map<string, { total: number; won: number }>();
  for (const r of rfps) {
    const score = r.wvFitScore ?? "TBD";
    if (!fitMap.has(score)) fitMap.set(score, { total: 0, won: 0 });
    const entry = fitMap.get(score)!;
    entry.total += 1;
    if (r.status === "won") entry.won += 1;
  }
  const fitOrder = ["high fit", "medium fit", "low fit", "TBD"];
  const byFitScore = fitOrder
    .filter((score) => fitMap.has(score))
    .map((score) => {
      const v = fitMap.get(score)!;
      return {
        score,
        total: v.total,
        won: v.won,
        rate: v.total > 0 ? Math.round((v.won / v.total) * 100) : 0,
      };
    });

  // recent outcomes — last 8 completed, sorted by lastEditedTime desc
  const recentOutcomes = completed
    .sort((a: RfpOpportunity, b: RfpOpportunity) =>
      new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime()
    )
    .slice(0, 8)
    .map((r: RfpOpportunity) => ({
      id: r.id,
      name: r.opportunityName,
      status: r.status,
      value: r.estimatedValue,
      source: r.source ?? null,
    }));

  return {
    totalActive,
    totalPipelineValue,
    totalWon,
    totalLost,
    winRate,
    wonValue,
    bySource,
    byFitScore,
    recentOutcomes,
  };
}

async function fetchDataHealth() {
  const { data: orgs } = await queryOrganizations(undefined, { pageSize: 200 });
  const missingWebsite = orgs.filter((o) => !o.website);
  const missingEnrichment = orgs.filter((o) => !o.enrichedAt);
  return {
    total: orgs.length,
    missingWebsite: missingWebsite.slice(0, 10).map((o) => ({ id: o.id, name: o.organization })),
    missingWebsiteCount: missingWebsite.length,
    missingEnrichmentCount: missingEnrichment.length,
  };
}

async function fetchAnalytics() {
  const [{ data: campaigns }, { data: drafts }] = await Promise.all([
    queryCampaigns(undefined, { pageSize: 200 }),
    queryEmailDrafts({ status: "sent" }, { pageSize: 500 }),
  ]);

  // totals
  const sent = drafts.length;
  const opens = drafts.reduce((sum: number, d: EmailDraft) => sum + (d.opens ?? 0), 0);
  const clicks = drafts.reduce((sum: number, d: EmailDraft) => sum + (d.clicks ?? 0), 0);
  const openRate = sent > 0 ? Math.round((opens / sent) * 100) : 0;
  const clickRate = sent > 0 ? Math.round((clicks / sent) * 100) : 0;

  // campaign status breakdown
  const statusBreakdown = { draft: 0, active: 0, paused: 0, complete: 0 };
  for (const c of campaigns) {
    if (c.status === "draft") statusBreakdown.draft++;
    else if (c.status === "active") statusBreakdown.active++;
    else if (c.status === "paused") statusBreakdown.paused++;
    else if (c.status === "complete") statusBreakdown.complete++;
  }

  // monthly trend
  const labels = buildLastSixMonths();
  const byMonth: Record<string, { sent: number; opens: number; clicks: number }> = {};
  for (const label of labels) byMonth[label] = { sent: 0, opens: 0, clicks: 0 };
  for (const draft of drafts) {
    if (!draft.sentAt) continue;
    const label = toMonthLabel(draft.sentAt);
    if (byMonth[label]) {
      byMonth[label].sent += 1;
      byMonth[label].opens += draft.opens ?? 0;
      byMonth[label].clicks += draft.clicks ?? 0;
    }
  }
  const monthlyTrend = labels.map((month) => ({ month, ...byMonth[month] }));

  return {
    sent,
    opens,
    clicks,
    openRate,
    clickRate,
    totalCampaigns: campaigns.length,
    statusBreakdown,
    monthlyTrend,
  };
}

// ── sub-components ────────────────────────────────────────────────────────────

function StatCard({
  value,
  label,
  colorClass = "text-foreground",
}: {
  value: string;
  label: string;
  colorClass?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-0.5">
      <span className={`text-xl font-bold tabular-nums ${colorClass}`}>{value}</span>
      <span className="text-[11px] text-muted-foreground">{label}</span>
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  draft: "bg-gray-100 text-gray-700",
  paused: "bg-amber-100 text-amber-800",
  complete: "bg-blue-100 text-blue-800",
};

function StatusBadge({ label, count }: { label: string; count: number }) {
  const colors = STATUS_COLORS[label] ?? "bg-muted text-muted-foreground";
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3">
      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${colors}`}>{label}</span>
      <span className="text-lg font-bold tabular-nums">{count}</span>
    </div>
  );
}

function CssBarChart({
  data,
}: {
  data: Array<{ month: string; sent: number; opens: number; clicks: number }>;
}) {
  const maxSent = Math.max(...data.map((d) => d.sent), 1);

  return (
    <div className="space-y-2">
      {/* legend */}
      <div className="flex items-center gap-4 text-[11px] text-muted-foreground mb-3">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-primary/70" />
          sent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-500/70" />
          opens
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-amber-500/70" />
          clicks
        </span>
      </div>

      {data.map(({ month, sent, opens, clicks }) => {
        const sentPct = Math.round((sent / maxSent) * 100);
        const opensPct = sent > 0 ? Math.round((opens / sent) * 100) : 0;
        const clicksPct = sent > 0 ? Math.round((clicks / sent) * 100) : 0;
        return (
          <div key={month} className="grid grid-cols-[56px_1fr] items-center gap-3">
            <span className="text-[11px] text-muted-foreground text-right shrink-0">{month}</span>
            <div className="flex flex-col gap-0.5">
              {/* sent bar */}
              <div className="h-3 rounded-sm bg-muted overflow-hidden">
                <div
                  className="h-full rounded-sm bg-primary/70 transition-all"
                  style={{ width: `${sentPct}%` }}
                  title={`${sent} sent`}
                />
              </div>
              {/* opens bar */}
              <div className="h-2 rounded-sm bg-muted overflow-hidden">
                <div
                  className="h-full rounded-sm bg-green-500/70 transition-all"
                  style={{ width: `${opensPct}%` }}
                  title={`${opens} opens (${opensPct}%)`}
                />
              </div>
              {/* clicks bar */}
              <div className="h-2 rounded-sm bg-muted overflow-hidden">
                <div
                  className="h-full rounded-sm bg-amber-500/70 transition-all"
                  style={{ width: `${clicksPct}%` }}
                  title={`${clicks} clicks (${clicksPct}%)`}
                />
              </div>
            </div>
          </div>
        );
      })}

      {data.every((d) => d.sent === 0) && (
        <p className="text-sm text-muted-foreground text-center py-4">no sent emails in the last 6 months</p>
      )}
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

const RFP_OUTCOME_COLORS: Record<string, string> = {
  won: "bg-green-100 text-green-800",
  lost: "bg-red-100 text-red-800",
  "no-go": "bg-amber-100 text-amber-800",
  "missed deadline": "bg-slate-100 text-slate-600",
};

export default async function AnalyticsPage() {
  const [data, health, rfp] = await Promise.all([
    fetchAnalytics(),
    fetchDataHealth(),
    fetchRfpAnalytics(),
  ]);

  const winRateColor =
    rfp.winRate >= 50
      ? "text-green-600"
      : rfp.winRate >= 25
        ? "text-amber-600"
        : "text-muted-foreground";

  const openRateColor =
    data.openRate >= 30
      ? "text-green-600"
      : data.openRate >= 15
        ? "text-amber-600"
        : "text-muted-foreground";

  const clickRateColor =
    data.clickRate >= 5
      ? "text-green-600"
      : data.clickRate >= 2
        ? "text-amber-600"
        : "text-muted-foreground";

  return (
    <>
      <PageHeader
        title="analytics"
        description="email performance and campaign activity across all sequences"
      />

      {/* stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        <StatCard value={data.sent.toLocaleString()} label="emails sent" />
        <StatCard value={`${data.openRate}%`} label="avg open rate" colorClass={openRateColor} />
        <StatCard value={`${data.clickRate}%`} label="avg click rate" colorClass={clickRateColor} />
        <StatCard value={data.totalCampaigns.toString()} label="total campaigns" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* campaign status breakdown */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">campaign status</h2>
          <div className="grid grid-cols-2 gap-2">
            {(["active", "draft", "paused", "complete"] as const).map((status) => (
              <StatusBadge key={status} label={status} count={data.statusBreakdown[status]} />
            ))}
          </div>
        </section>

        {/* monthly trend */}
        <section>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">monthly trend — last 6 months</h2>
          <div className="rounded-lg border border-border bg-card px-4 py-4">
            <CssBarChart data={data.monthlyTrend} />
          </div>
        </section>
      </div>

      {/* data health */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">data health</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
          <StatCard value={health.total.toString()} label="total orgs" />
          <StatCard
            value={health.missingWebsiteCount.toString()}
            label="missing website URL"
            colorClass={health.missingWebsiteCount > 0 ? "text-amber-600" : "text-green-600"}
          />
          <StatCard
            value={health.missingEnrichmentCount.toString()}
            label="never enriched"
            colorClass={health.missingEnrichmentCount > 0 ? "text-amber-600" : "text-green-600"}
          />
        </div>
        {health.missingWebsite.length > 0 && (
          <div className="rounded-lg border border-border bg-card px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">
              orgs missing website URL {health.missingWebsiteCount > 10 ? `(showing 10 of ${health.missingWebsiteCount})` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              {health.missingWebsite.map((o) => (
                <Link
                  key={o.id}
                  href={`/organizations/${o.id}`}
                  className="text-xs px-2 py-1 rounded-md bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100 transition-colors"
                >
                  {o.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* RFP pipeline analytics */}
      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">RFP pipeline</h2>

        {/* stats strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard value={rfp.totalActive.toString()} label="active opportunities" />
          <StatCard value={formatCurrency(rfp.totalPipelineValue)} label="pipeline value" />
          <StatCard value={`${rfp.winRate}%`} label="win rate" colorClass={winRateColor} />
          <StatCard value={formatCurrency(rfp.wonValue)} label="won value" colorClass="text-green-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* conversion by source */}
          <div className="rounded-lg border border-border bg-card px-4 py-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-4">conversion by source</h3>
            {rfp.bySource.filter((s) => s.total >= 2).length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">not enough data yet</p>
            ) : (
              <div className="space-y-3">
                {rfp.bySource
                  .filter((s) => s.total >= 2)
                  .map((s) => (
                    <div key={s.source} className="grid grid-cols-[120px_1fr_auto] items-center gap-3">
                      <span className="text-[11px] text-muted-foreground text-right truncate shrink-0">{s.source}</span>
                      <div className="h-3 rounded-sm bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-sm bg-green-500/70 transition-all"
                          style={{ width: `${s.rate}%` }}
                          title={`${s.rate}% win rate`}
                        />
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {s.won} won / {s.total} total
                      </span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* conversion by fit score */}
          <div className="rounded-lg border border-border bg-card px-4 py-4">
            <h3 className="text-xs font-medium text-muted-foreground mb-4">conversion by fit score</h3>
            {rfp.byFitScore.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">not enough data yet</p>
            ) : (
              <div className="space-y-3">
                {rfp.byFitScore.map((s) => (
                  <div key={s.score} className="grid grid-cols-[90px_1fr_auto] items-center gap-3">
                    <span className="text-[11px] text-muted-foreground text-right truncate shrink-0">{s.score}</span>
                    <div className="h-3 rounded-sm bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-sm bg-primary/70 transition-all"
                        style={{ width: `${s.rate}%` }}
                        title={`${s.rate}% win rate`}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                      {s.won} won / {s.total} total
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* recent outcomes */}
        {rfp.recentOutcomes.length > 0 && (
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-xs font-medium text-muted-foreground">recent outcomes</h3>
            </div>
            <div className="divide-y divide-border">
              {rfp.recentOutcomes.map((o) => {
                const badgeClass = RFP_OUTCOME_COLORS[o.status] ?? "bg-muted text-muted-foreground";
                const notionUrl = `https://notion.so/${o.id.replace(/-/g, "")}`;
                const truncatedName = o.name.length > 40 ? o.name.slice(0, 40) + "…" : o.name;
                return (
                  <div key={o.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2.5">
                    <a
                      href={notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline truncate"
                      title={o.name}
                    >
                      {truncatedName}
                    </a>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>
                      {o.status}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {o.value != null ? formatCurrency(o.value) : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                      {o.source ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </>
  );
}
