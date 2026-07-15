/**
 * /strategy — Marketing Strategy Command Centre
 *
 * Phase 1 (Tuesday May 5 8am PT deadline) — interactive presentation of the
 * Q2–Q3 2026 strategy authored by the CMO (Claude). Hardcoded content from
 * .brain/memory/marketing/* via port/lib/strategy-data.ts.
 *
 * Layout:
 *   - PageHeader
 *   - StrategyHero (full-width, urgency + plan)
 *   - TeamPulseStrip (member filter chips)
 *   - UrlTabs: strategy | campaigns | channels | audience | pipeline | distribution | timeline
 *
 * Live data: getSocialStatsFromSnapshot() flows into hero + pipeline tab;
 * getCampaignsFromSupabase() flows into campaigns tab for CRM linking.
 */

import { Suspense } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { PageHeader } from "@/app/components/page-header";
import { AssignResearchTopic } from "@/app/components/assign-research-topic";
import { UrlTabs, type TabDef } from "@/app/components/url-tabs";
import { CardGridSkeleton } from "@/app/components/skeletons";
import { getSocialStatsFromSnapshot } from "@/lib/marketing/social-stats";
import { getPipelineProgress } from "@/lib/marketing/pipeline-progress";
import { fetchRfpAnalytics, fetchEmailAnalytics, fetchActivePipelineOpportunities } from "@/lib/marketing/rfp-analytics";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { getProjectsFromSupabase } from "@/lib/supabase/projects";
import { getStrategyTimelines } from "@/lib/supabase/strategy-timelines";
import { getTimelineItems } from "@/lib/supabase/cmo-timeline-items";
import { getStrategyDistribution } from "@/lib/supabase/strategy-distribution";
import { CAMPAIGN_TIMELINES, DISTRIBUTION, getRevenueProgress } from "@/lib/strategy-data";
import { TeamPulseStrip } from "./components/team-pulse-strip";
import { DocentWelcomeBanner } from "@/app/components/docent-welcome-banner";
import { StrategyTab } from "./components/strategy-tab";
import { CampaignsTab } from "./components/campaigns-tab";
import { ChannelsTab } from "./components/channels-tab";
import { AudienceTab } from "./components/audience-tab";
import { PipelineTab } from "./components/pipeline-tab";
import { DistributionTab } from "./components/distribution-tab";
import { TimelineTab } from "./components/timeline-tab";
import { CompetitorsTab } from "./components/competitors-tab";
import { MoLogTab } from "./components/mo-log-tab";
import { StrategyBriefTab } from "./components/strategy-brief-tab";
import { getCmoDecisions, getCmoMemory } from "@/lib/supabase/cmo";
import { getStrategyBrief } from "@/lib/supabase/cmo-strategy-brief";
import { CarlInsightsPanel } from "@/app/components/carl-insights-panel";
import { AgentPageWithChat } from "@/app/components/agent-page-with-chat";
import { auth } from "@/lib/auth";

const TABS: readonly TabDef[] = [
  { key: "strategy", label: "strategy" },
  { key: "strategy-brief", label: "strategy brief" },
  { key: "campaigns", label: "campaigns" },
  { key: "channels", label: "channels" },
  { key: "audience", label: "audience" },
  { key: "pipeline", label: "pipeline" },
  { key: "distribution", label: "distribution" },
  { key: "timeline", label: "timeline" },
  { key: "competitors", label: "competitors" },
  { key: "mo-log", label: "Mo's log" },
];

export default async function StrategyPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const tabParam = typeof sp.tab === "string" ? sp.tab : undefined;
  const memberParam = typeof sp.member === "string" ? sp.member : undefined;

  const activeTab =
    TABS.find((t) => t.key === tabParam)?.key ?? "strategy";
  const memberFilter = memberParam ?? null;

  const [stats, allCampaigns, pipelineProgress, rfpAnalytics, emailAnalytics, livePipeline, pmProjectsResult, liveTimelines, liveDistribution, moDecisions, revenueSummary, moMemory, strategyBrief, timelineItems, session] = await Promise.all([
    getSocialStatsFromSnapshot().catch(() => null),
    getCampaignsFromSupabase().catch(
      () => [] as Awaited<ReturnType<typeof getCampaignsFromSupabase>>,
    ),
    // Tier 1 of the operationalization plan — derive proposals + contracts
    // counts from primary data instead of hardcoding. Failures fall back
    // to the static PIPELINE_PROGRESS values via PipelineFunnel.
    getPipelineProgress().catch(() => undefined),
    // Live RFP pipeline performance + email metrics (formerly /analytics page).
    fetchRfpAnalytics().catch(() => null),
    fetchEmailAnalytics().catch(() => null),
    // Live active pipeline opportunities from RFP Lighthouse (rfp_opportunities).
    // Falls back to the hardcoded REVENUE_PIPELINE in pipeline-tab.tsx on error.
    fetchActivePipelineOpportunities().catch(() => []),
    // Live PM projects for distribution matrix "active portfolio" section.
    getProjectsFromSupabase({ archive: false }).catch(() => ({ data: [], total: 0 })),
    // Campaign timelines (Gantt) — falls back to hardcoded array on error.
    getStrategyTimelines().catch(() => CAMPAIGN_TIMELINES),
    // Distribution items — falls back to hardcoded array on error.
    getStrategyDistribution().catch(() => DISTRIBUTION),
    // Mo's conversation log — last 90 days.
    getCmoDecisions({ days: 90 }).catch(() => []),
    // Aggregated revenue summary (origin_type + tier breakdown) for the pipeline tab.
    // Feeds data from the phase-3 origin_type column; gracefully returns null on error.
    getRevenueProgress().catch(() => null),
    // Mo's working memory — used to surface cARL's prepared insights at the top.
    getCmoMemory().catch(() => []),
    // Strategy brief — the port's first human write-UI. Null on first load
    // (no brief saved yet) or on fetch error; the tab handles both.
    getStrategyBrief().catch(() => null),
    // Multi-view Gantt items (cmo_timeline_items) — falls back to an empty
    // list on error; the tab renders an empty state rather than 500ing.
    getTimelineItems().catch(() => []),
    auth().catch(() => null),
  ]);
  const pmProjects = pmProjectsResult.data;
  const crmCampaigns = allCampaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
  }));

  return (
    <>
    <div className="space-y-6 mb-6">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="strategy"
          description="q2–q3 2026 · marketing command centre · cmo: claude · sponsor: garrett"
        />
        <AssignResearchTopic assignedBy="Mo" label="brief cARL" />
      </div>

      <DocentWelcomeBanner />

      <Link
        href="/biz"
        className="flex items-center gap-2 text-sm font-medium p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors text-foreground"
      >
        <TrendingUp className="h-4 w-4 text-emerald-500" />
        revenue progress → biz page
      </Link>

      <TeamPulseStrip activeMember={memberFilter} timelines={liveTimelines} distributionItems={liveDistribution} />
    </div>
    <AgentPageWithChat agentId="mo">
    <div className="space-y-6">
      <UrlTabs tabs={TABS} activeTab={activeTab} />

      {activeTab === "strategy" && <StrategyTab />}
      {activeTab === "strategy-brief" && (
        <StrategyBriefTab brief={strategyBrief} isSignedIn={!!session?.user?.email} />
      )}
      {activeTab === "campaigns" && (
        <CampaignsTab
          crmCampaigns={crmCampaigns}
          memberFilter={memberFilter}
          emailAnalytics={emailAnalytics}
        />
      )}
      {activeTab === "channels" && <ChannelsTab />}
      {activeTab === "audience" && <AudienceTab />}
      {activeTab === "pipeline" && (
        <PipelineTab stats={stats} pipelineProgress={pipelineProgress} rfpAnalytics={rfpAnalytics} livePipeline={livePipeline} revenueSummary={revenueSummary} />
      )}
      {activeTab === "distribution" && (
        <DistributionTab memberFilter={memberFilter} items={liveDistribution} pmProjects={pmProjects} />
      )}
      {activeTab === "timeline" && <TimelineTab timelines={liveTimelines} items={timelineItems} />}
      {activeTab === "competitors" && (
        <Suspense fallback={<CardGridSkeleton />}>
          <CompetitorsTab />
        </Suspense>
      )}
      {activeTab === "mo-log" && <MoLogTab decisions={moDecisions} />}

      {/* cARL's prepared insights — tucked at the bottom, collapsed by default */}
      <CarlInsightsPanel entries={moMemory} />

      {/* doc meta */}
      <div className="text-[10px] text-muted-foreground space-y-0.5 px-1 pt-4">
        <p>version 2.0 · effective may 5, 2026</p>
        <p>next review: june 30, 2026</p>
        <p>data source: .brain/memory/marketing/ · live KPIs from supabase + social-stats</p>
      </div>
    </div>
    </AgentPageWithChat>
    </>
  );
}
