/**
 * GET /api/analytics/campaigns
 *
 * Aggregates email draft and campaign data from Notion into analytics stats:
 *   - Overall totals (sent, opens, clicks, rates)
 *   - Campaign status breakdown
 *   - Monthly trend for last 6 months
 *   - topCampaigns: empty array (no campaign_id on drafts to join)
 */

import { queryCampaigns } from "@/lib/notion/campaigns";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import { withNotionError, json } from "@/lib/api-helpers";
import type { Campaign, EmailDraft } from "@/lib/notion/types";

export interface AnalyticsTotals {
  sent: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
}

export interface CampaignStatusBreakdown {
  draft: number;
  active: number;
  paused: number;
  complete: number;
}

export interface MonthlyTrendEntry {
  month: string; // e.g. "Jan 25"
  sent: number;
  opens: number;
  clicks: number;
}

export interface AnalyticsResponse {
  totals: AnalyticsTotals;
  campaignStatusBreakdown: CampaignStatusBreakdown;
  monthlyTrend: MonthlyTrendEntry[];
  topCampaigns: [];
}

/** ISO date string → "Jan 25" label */
function toMonthLabel(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
}

/** Build an ordered array of the last 6 month labels (oldest → newest). */
function buildLastSixMonths(): string[] {
  const months: string[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(
      d.toLocaleDateString("en-US", { month: "short", year: "2-digit" }),
    );
  }
  return months;
}

function computeStatusBreakdown(campaigns: Campaign[]): CampaignStatusBreakdown {
  const breakdown: CampaignStatusBreakdown = { draft: 0, active: 0, paused: 0, complete: 0 };
  for (const c of campaigns) {
    if (c.status === "draft") breakdown.draft++;
    else if (c.status === "active") breakdown.active++;
    else if (c.status === "paused") breakdown.paused++;
    else if (c.status === "complete") breakdown.complete++;
  }
  return breakdown;
}

function computeTotals(drafts: EmailDraft[]): AnalyticsTotals {
  const sent = drafts.length;
  // Binary unique-opener counts: a recipient counts once regardless of how many
  // times Resend fires the open/click webhook. Matches per-campaign analytics
  // and the industry-standard definition of open/click rate.
  const opens = drafts.filter((d) => (d.opens ?? 0) > 0).length;
  const clicks = drafts.filter((d) => (d.clicks ?? 0) > 0).length;
  return {
    sent,
    opens,
    clicks,
    openRate: sent > 0 ? Math.round((opens / sent) * 100) : 0,
    clickRate: sent > 0 ? Math.round((clicks / sent) * 100) : 0,
  };
}

function computeMonthlyTrend(drafts: EmailDraft[]): MonthlyTrendEntry[] {
  const labels = buildLastSixMonths();
  const byMonth: Record<string, { sent: number; opens: number; clicks: number }> = {};
  for (const label of labels) {
    byMonth[label] = { sent: 0, opens: 0, clicks: 0 };
  }

  for (const draft of drafts) {
    if (!draft.sentAt) continue;
    const label = toMonthLabel(draft.sentAt);
    if (byMonth[label]) {
      byMonth[label].sent += 1;
      // Binary: count the recipient once if they opened/clicked at all
      if ((draft.opens ?? 0) > 0) byMonth[label].opens += 1;
      if ((draft.clicks ?? 0) > 0) byMonth[label].clicks += 1;
    }
  }

  return labels.map((month) => ({ month, ...byMonth[month] }));
}

export async function GET() {
  return withNotionError(async () => {
    const [{ data: campaigns }, { data: drafts }] = await Promise.all([
      queryCampaigns(undefined, { pageSize: 200 }),
      queryEmailDrafts({ status: "sent" }, { pageSize: 500 }),
    ]);

    const response: AnalyticsResponse = {
      totals: computeTotals(drafts),
      campaignStatusBreakdown: computeStatusBreakdown(campaigns),
      monthlyTrend: computeMonthlyTrend(drafts),
      topCampaigns: [],
    };

    return json(response);
  });
}
