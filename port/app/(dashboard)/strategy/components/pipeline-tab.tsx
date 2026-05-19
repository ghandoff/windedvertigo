/**
 * pipeline-tab.tsx — pipeline funnel + KPIs + concrete pipeline rows.
 *
 * Stack:
 *   1. Live KPI cards (4 across) — substack subs, social followers, harbour signups, campaign reach
 *   2. Pipeline funnel viz
 *   3. Weekly KPIs table (leading + lagging)
 *   4. Concrete pipeline rows (5 RFP/SOW opportunities)
 */

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Users, Heart, TrendingUp, ArrowUpRight } from "lucide-react";
import {
  REVENUE_PIPELINE,
  WEEKLY_KPIS,
  fmt,
  pct,
  probabilityClass,
} from "@/lib/strategy-data";
import { PipelineFunnel, type PipelineProgressOverrides } from "./pipeline-funnel";
import { ClickableKpiCard } from "./kpi-source-modal";
import { SyncNowButton } from "../sync-now-button";
import { formatUSD, type RfpAnalytics, type LivePipelineRow } from "@/lib/marketing/rfp-analytics";

/** Full snapshot shape (matches `SocialStatsSnapshot` from lib/marketing/social-stats.ts).
    Loosely typed here to avoid coupling the tab to the marketing internals. */
export interface PipelineTabProps {
  stats: {
    totalSubscribers: number;
    totalFollowers: number;
    totalRecentEngagement: number;
    totalCampaignActivity: number;
    totalEngagement: number;
    generatedAt: string | null;
    port?: {
      uniqueRecipients?: number;
      totalEmailsSent?: number;
      totalOpens?: number;
      totalClicks?: number;
    } | null;
    substack?: { totalSubscribers: number | null } | null;
    meta?: {
      instagramFollowers: number | null;
      facebookPageFollowers: number | null;
      instagramRecentEngagement?: number | null;
      facebookRecentEngagement?: number | null;
    } | null;
    linkedin?: {
      followerCount: number | null;
      recentPostEngagement?: number | null;
    } | null;
    bluesky?: {
      followerCount: number | null;
      recentPostEngagement?: number | null;
    } | null;
  } | null;
  /** Tier 1 derived counts (see lib/marketing/pipeline-progress.ts) */
  pipelineProgress?: PipelineProgressOverrides;
  /** Live RFP performance data (formerly /analytics page). Null if fetch failed. */
  rfpAnalytics?: RfpAnalytics | null;
  /** Live active pipeline rows from RFP Lighthouse. Empty array = use static fallback. */
  livePipeline?: LivePipelineRow[];
}

export function PipelineTab({ stats, pipelineProgress, rfpAnalytics, livePipeline }: PipelineTabProps) {
  const subscribersTarget = 2000;
  const followersTarget = 5000;
  const campaignActivityTarget = 100;

  const subs = stats?.totalSubscribers ?? 0;
  const followers = stats?.totalFollowers ?? 0;
  const campaignActivity = stats?.totalCampaignActivity ?? 0;
  const campaignEngagement = stats?.totalEngagement ?? 0;
  const socialEngagement = stats?.totalRecentEngagement ?? 0;

  const leadingKpis = WEEKLY_KPIS.filter((k) => k.type === "leading");
  const laggingKpis = WEEKLY_KPIS.filter((k) => k.type === "lagging");

  return (
    <div className="space-y-6">
      {/* revenue tracker tile retired 2026-05-05 — its bar was redundant with
          the strategy-hero tile at the top of /strategy, and its per-contract
          chips were merged into that hero (now a 4-tier confidence ladder).
          Pipeline tab now opens straight to the live KPI strip. */}

      {/* live KPI strip — each tile is now clickable, opens a source-detail
          modal so the team can audit where each number comes from */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ClickableKpiCard kind="substack-subscribers" stats={stats}>
          <KpiCard
            icon={<Mail className="h-4 w-4 text-[#273248]" />}
            label="substack subscribers"
            value={fmt(subs)}
            progressPct={pct(subs, subscribersTarget)}
            colour="bg-blue-500"
            sub={stats?.substack ? `${pct(subs, subscribersTarget)}% of ${fmt(subscribersTarget)}` : "awaiting first sync · click to inspect"}
          />
        </ClickableKpiCard>
        <ClickableKpiCard kind="social-followers" stats={stats}>
          <KpiCard
            icon={<Heart className="h-4 w-4 text-[#273248]" />}
            label="social followers"
            value={fmt(followers)}
            progressPct={pct(followers, followersTarget)}
            colour="bg-rose-500"
            sub={`target ${fmt(followersTarget)} aggregate · click to inspect`}
          />
        </ClickableKpiCard>
        <ClickableKpiCard kind="harbour-signups" stats={stats}>
          <KpiCard
            icon={<Users className="h-4 w-4 text-[#273248]" />}
            label="harbour sign-ups"
            value={fmt(0)}
            progressPct={0}
            colour="bg-violet-500"
            sub="launches may 28 · click to inspect"
          />
        </ClickableKpiCard>
        <ClickableKpiCard kind="campaign-reach" stats={stats}>
          <KpiCard
            icon={<TrendingUp className="h-4 w-4 text-[#273248]" />}
            label="campaign reach"
            value={fmt(campaignActivity)}
            progressPct={pct(campaignActivity, campaignActivityTarget)}
            colour="bg-amber-500"
            sub={`${fmt(campaignEngagement)} engagement events · ${fmt(socialEngagement)} social`}
          />
        </ClickableKpiCard>
      </div>

      {/* sync button */}
      <div className="flex justify-end">
        <SyncNowButton lastSyncedAt={stats?.generatedAt ?? null} />
      </div>

      {/* funnel */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            pipeline funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PipelineFunnel overrides={pipelineProgress} />
          <p className="text-[11px] text-muted-foreground italic mt-4 leading-relaxed">
            $500k target ÷ $50k avg contract = 10 contracts in 5 months ≈
            2/month. at 40% win rate that's 5 proposals/month, ~8 meaningful
            conversations/month, ~30 outreach touches/week blended.
          </p>
        </CardContent>
      </Card>

      {/* leading + lagging KPI tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#273248]">
              leading indicators (marketing)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>metric</TableHead>
                  <TableHead className="text-right">target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leadingKpis.map((k) => (
                  <TableRow key={k.metric} className="text-sm">
                    <TableCell>
                      <div className="font-medium">{k.metric}</div>
                      <div className="text-[10px] text-muted-foreground">{k.why}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {k.target}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[#273248]">
              lagging indicators (revenue)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>metric</TableHead>
                  <TableHead className="text-right">target</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {laggingKpis.map((k) => (
                  <TableRow key={k.metric} className="text-sm">
                    <TableCell>
                      <div className="font-medium">{k.metric}</div>
                      <div className="text-[10px] text-muted-foreground">{k.why}</div>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium tabular-nums">
                      {k.target}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* concrete pipeline — live from RFP Lighthouse when available, static fallback otherwise */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-[#273248]">
              current pipeline
              {livePipeline && livePipeline.length > 0 && (
                <span className="text-xs text-muted-foreground font-normal ml-2">· live</span>
              )}
            </CardTitle>
            <Link
              href="/opportunities?tab=rfps"
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              rfp radar <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="text-xs">
                <TableHead>opportunity</TableHead>
                <TableHead>stage</TableHead>
                <TableHead className="tabular-nums">est. value</TableHead>
                <TableHead className="text-center tabular-nums">probability</TableHead>
                <TableHead>timeline</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(livePipeline && livePipeline.length > 0 ? livePipeline : REVENUE_PIPELINE).map((row) => (
                <TableRow key={row.opportunity} className="text-sm">
                  <TableCell className="font-medium">
                    {"id" in row ? (
                      <Link
                        href={`/opportunities?rfp=${row.id}`}
                        className="hover:underline hover:text-[#273248] transition-colors inline-flex items-center gap-1"
                      >
                        {row.opportunity}
                        <ArrowUpRight className="h-3 w-3 text-muted-foreground shrink-0" />
                      </Link>
                    ) : (
                      row.opportunity
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{row.stage}</TableCell>
                  <TableCell className="tabular-nums text-xs font-medium">{row.estValue}</TableCell>
                  <TableCell className="text-center">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full border font-medium tabular-nums ${probabilityClass(row.probability)}`}
                    >
                      {row.probability}%
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{row.timeline}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="px-4 py-3 border-t bg-muted/30">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span>conservative: <strong className="text-foreground">$350,000</strong></span>
              <span>optimistic: <strong className="text-[#b15043]">$500,000+</strong></span>
              <span>gap: <strong className="text-foreground">~$150k</strong> — closed through disciplined execution</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── pipeline performance (live from Supabase, formerly /analytics) ── */}
      {rfpAnalytics && <PipelinePerformance data={rfpAnalytics} />}
    </div>
  );
}

// ── Pipeline Performance section ──────────────────────────────────────

const OUTCOME_COLORS: Record<string, string> = {
  won:               "bg-green-100 text-green-800",
  lost:              "bg-red-100 text-red-800",
  "no-go":           "bg-amber-100 text-amber-800",
  "missed deadline": "bg-slate-100 text-slate-600",
};

function PerfStatCard({
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

function ConversionBar({
  label,
  rate,
  won,
  total,
  labelWidth = "120px",
}: {
  label: string;
  rate: number;
  won: number;
  total: number;
  labelWidth?: string;
}) {
  return (
    <div className="grid items-center gap-3" style={{ gridTemplateColumns: `${labelWidth} 1fr auto` }}>
      <span className="text-[11px] text-muted-foreground text-right truncate shrink-0">{label}</span>
      <div className="h-3 rounded-sm bg-muted overflow-hidden">
        <div
          className="h-full rounded-sm bg-green-500/70 transition-all"
          style={{ width: `${rate}%` }}
          title={`${rate}% win rate`}
        />
      </div>
      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
        {won} won / {total} total
      </span>
    </div>
  );
}

function PipelinePerformance({ data }: { data: RfpAnalytics }) {
  const winRateColor =
    data.winRate >= 50 ? "text-green-600" : data.winRate >= 25 ? "text-amber-600" : "text-muted-foreground";

  return (
    <div className="space-y-4 pt-2">
      {/* section heading */}
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-[#273248]">pipeline performance</h3>
        <div className="flex-1 h-px bg-border" />
        <Link
          href="/opportunities?tab=rfps"
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          view rfp radar →
        </Link>
      </div>

      {/* 4-stat strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <PerfStatCard value={data.totalActive.toString()} label="active opportunities" />
        <PerfStatCard value={formatUSD(data.totalPipelineValue)} label="pipeline value" />
        <PerfStatCard value={`${data.winRate}%`} label="win rate" colorClass={winRateColor} />
        <PerfStatCard value={formatUSD(data.wonValue)} label="won value" colorClass="text-green-600" />
      </div>

      {/* conversion charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card px-4 py-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-4">conversion by source</h4>
          {data.bySource.filter((s) => s.total >= 2).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">not enough data yet</p>
          ) : (
            <div className="space-y-3">
              {data.bySource
                .filter((s) => s.total >= 2)
                .map((s) => (
                  <ConversionBar
                    key={s.source}
                    label={s.source}
                    rate={s.rate}
                    won={s.won}
                    total={s.total}
                    labelWidth="120px"
                  />
                ))}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border bg-card px-4 py-4">
          <h4 className="text-xs font-medium text-muted-foreground mb-4">conversion by fit score</h4>
          {data.byFitScore.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">not enough data yet</p>
          ) : (
            <div className="space-y-3">
              {data.byFitScore.map((s) => (
                <ConversionBar
                  key={s.score}
                  label={s.score}
                  rate={s.rate}
                  won={s.won}
                  total={s.total}
                  labelWidth="90px"
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* recent outcomes */}
      {data.recentOutcomes.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-[#273248]">recent outcomes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {data.recentOutcomes.map((o) => {
                const badgeClass = OUTCOME_COLORS[o.status] ?? "bg-muted text-muted-foreground";
                const notionUrl = `https://notion.so/${o.id.replace(/-/g, "")}`;
                const truncated = o.name.length > 40 ? o.name.slice(0, 40) + "…" : o.name;
                return (
                  <div key={o.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2.5">
                    <a
                      href={notionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline truncate"
                      title={o.name}
                    >
                      {truncated}
                    </a>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap ${badgeClass}`}>
                      {o.status}
                    </span>
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                      {o.value != null ? formatUSD(o.value) : "—"}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:block">
                      {o.source ?? "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  progressPct,
  colour,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  progressPct: number;
  colour: string;
  sub: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-1">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold tabular-nums text-[#273248]">{value}</p>
      <div className="w-full h-1.5 bg-muted rounded-full mt-1">
        <div
          className={`h-1.5 ${colour} rounded-full`}
          style={{ width: `${progressPct}%` }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">{sub}</p>
    </div>
  );
}

