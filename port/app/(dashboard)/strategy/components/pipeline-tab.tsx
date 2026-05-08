/**
 * pipeline-tab.tsx — pipeline funnel + KPIs + concrete pipeline rows.
 *
 * Stack:
 *   1. Live KPI cards (4 across) — substack subs, social followers, harbour signups, campaign reach
 *   2. Pipeline funnel viz
 *   3. Weekly KPIs table (leading + lagging)
 *   4. Concrete pipeline rows (5 RFP/SOW opportunities)
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Mail, Users, Heart, TrendingUp } from "lucide-react";
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
}

export function PipelineTab({ stats, pipelineProgress }: PipelineTabProps) {
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

      {/* concrete pipeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-[#273248]">
            current pipeline
          </CardTitle>
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
              {REVENUE_PIPELINE.map((row) => (
                <TableRow key={row.opportunity} className="text-sm">
                  <TableCell className="font-medium">{row.opportunity}</TableCell>
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

