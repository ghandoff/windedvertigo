/**
 * readStrategyDoc tool — exposes sections of port/lib/strategy-data.ts
 * (the source of truth for /strategy dashboard) to the wv-claw agent so
 * it can answer questions like "what's our positioning?" or "who owns
 * the IDB campaign?" without redirecting users to the dashboard.
 *
 * Read-only. No DB calls. The data is bundled at build time.
 */

import {
  REVENUE_TARGET,
  CASH_ON_HAND,
  RUNWAY_MONTHS,
  PRME_CONTRACT_TOTAL,
  PRME_RECEIVED,
  PIPELINE_MATH,
  REVENUE_PIPELINE,
  CAMPAIGNS,
  PHASES,
  TEAM,
  BUDGET,
  BUDGET_TOTAL,
  CAMPAIGN_TIMELINES,
  TIMELINE_RANGE,
  CHANNELS,
  AUDIENCE_SEGMENTS,
  PIPELINE_FUNNEL,
  WEEKLY_KPIS,
  DISTRIBUTION,
  WEEKLY_CADENCE,
} from "@/lib/strategy-data";

export type StrategySection =
  | "strategy"
  | "campaigns"
  | "channels"
  | "audience"
  | "pipeline"
  | "distribution"
  | "timeline";

export function readStrategyDocTool(section: StrategySection): unknown {
  switch (section) {
    case "strategy":
      return {
        effective: "may 5, 2026 (q2-q3 2026)",
        cmo: "claude (ai role) · sponsor: garrett",
        revenue_target_q2q3: REVENUE_TARGET,
        cash_on_hand: CASH_ON_HAND,
        runway_months: RUNWAY_MONTHS,
        prme_contract_total: PRME_CONTRACT_TOTAL,
        prme_received: PRME_RECEIVED,
        pipeline_math: PIPELINE_MATH,
        revenue_pipeline: REVENUE_PIPELINE,
        dashboard_url: "https://port.windedvertigo.com/mo",
      };
    case "campaigns":
      return {
        campaigns: CAMPAIGNS,
        campaign_timelines: CAMPAIGN_TIMELINES,
        timeline_range: TIMELINE_RANGE,
        dashboard_tab: "https://port.windedvertigo.com/mo?tab=campaigns",
      };
    case "channels":
      return {
        channels: CHANNELS,
        dashboard_tab: "https://port.windedvertigo.com/mo?tab=channels",
      };
    case "audience":
      return {
        audience_segments: AUDIENCE_SEGMENTS,
        dashboard_tab: "https://port.windedvertigo.com/mo?tab=audience",
      };
    case "pipeline":
      return {
        pipeline_math: PIPELINE_MATH,
        revenue_pipeline: REVENUE_PIPELINE,
        funnel: PIPELINE_FUNNEL,
        weekly_kpis: WEEKLY_KPIS,
        dashboard_tab: "https://port.windedvertigo.com/mo?tab=pipeline",
      };
    case "distribution":
      return {
        team: TEAM,
        distribution: DISTRIBUTION,
        budget: BUDGET,
        budget_total: BUDGET_TOTAL,
        dashboard_tab: "https://port.windedvertigo.com/mo?tab=distribution",
      };
    case "timeline":
      return {
        phases: PHASES,
        campaign_timelines: CAMPAIGN_TIMELINES,
        timeline_range: TIMELINE_RANGE,
        weekly_cadence: WEEKLY_CADENCE,
        dashboard_tab: "https://port.windedvertigo.com/mo?tab=timeline",
      };
  }
}
