/**
 * RFP pipeline analytics — extracted from /analytics page so the strategy
 * pipeline tab can consume the same data without duplicating the fetch logic.
 *
 * Exports:
 *   fetchRfpAnalytics()   — active pipeline + win rates + outcomes
 *   fetchEmailAnalytics() — email send / open / click metrics + 6-month trend
 */

import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import type { RfpOpportunity, EmailDraft } from "@/lib/notion/types";

// ── helpers ──────────────────────────────────────────────────────────

/** Format a number as $USD with no decimal places — for large pipeline values. */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

// ── RFP analytics ─────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["radar", "reviewing", "pursuing", "interviewing", "submitted"]);
const COMPLETED_STATUSES = new Set(["won", "lost", "no-go", "missed deadline"]);

export interface RfpOutcome {
  id: string;
  name: string;
  status: string;
  value: number | null;
  source: string | null;
}

export interface RfpAnalytics {
  totalActive: number;
  totalPipelineValue: number;
  winRate: number;
  wonValue: number;
  bySource: Array<{ source: string; total: number; won: number; rate: number }>;
  byFitScore: Array<{ score: string; total: number; won: number; rate: number }>;
  recentOutcomes: RfpOutcome[];
}

export async function fetchRfpAnalytics(): Promise<RfpAnalytics> {
  const { data: rfps } = await getRfpOpportunitiesFromSupabase({}, { pageSize: 200 });

  const active    = rfps.filter((r: RfpOpportunity) => ACTIVE_STATUSES.has(r.status));
  const completed = rfps.filter((r: RfpOpportunity) => COMPLETED_STATUSES.has(r.status));
  const won       = rfps.filter((r: RfpOpportunity) => r.status === "won");
  const lost      = rfps.filter((r: RfpOpportunity) => r.status === "lost");
  const noGo      = rfps.filter((r: RfpOpportunity) => r.status === "no-go");

  const totalActive       = active.length;
  const totalPipelineValue = active.reduce((s: number, r: RfpOpportunity) => s + (r.estimatedValue ?? 0), 0);
  const winDenomCount     = won.length + lost.length + noGo.length;
  const winRate           = winDenomCount > 0 ? Math.round((won.length / winDenomCount) * 100) : 0;
  const wonValue          = won.reduce((s: number, r: RfpOpportunity) => s + (r.estimatedValue ?? 0), 0);

  // conversion by source
  const sourceMap = new Map<string, { total: number; won: number }>();
  for (const r of rfps) {
    const src = r.source ?? "Unknown";
    if (!sourceMap.has(src)) sourceMap.set(src, { total: 0, won: 0 });
    const e = sourceMap.get(src)!;
    e.total += 1;
    if (r.status === "won") e.won += 1;
  }
  const bySource = Array.from(sourceMap.entries())
    .filter(([, v]) => v.total > 0)
    .map(([source, v]) => ({
      source,
      total: v.total,
      won:   v.won,
      rate:  Math.round((v.won / v.total) * 100),
    }))
    .sort((a, b) => b.total - a.total);

  // conversion by fit score
  const fitMap = new Map<string, { total: number; won: number }>();
  for (const r of rfps) {
    const score = r.wvFitScore ?? "TBD";
    if (!fitMap.has(score)) fitMap.set(score, { total: 0, won: 0 });
    const e = fitMap.get(score)!;
    e.total += 1;
    if (r.status === "won") e.won += 1;
  }
  const FIT_ORDER = ["high fit", "medium fit", "low fit", "TBD"];
  const byFitScore = FIT_ORDER
    .filter((s) => fitMap.has(s))
    .map((score) => {
      const v = fitMap.get(score)!;
      return { score, total: v.total, won: v.won, rate: Math.round((v.won / v.total) * 100) };
    });

  // recent outcomes — last 8 completed, newest first
  const recentOutcomes = completed
    .sort((a: RfpOpportunity, b: RfpOpportunity) =>
      new Date(b.lastEditedTime).getTime() - new Date(a.lastEditedTime).getTime(),
    )
    .slice(0, 8)
    .map((r: RfpOpportunity) => ({
      id:     r.id,
      name:   r.opportunityName,
      status: r.status,
      value:  r.estimatedValue ?? null,
      source: r.source ?? null,
    }));

  return { totalActive, totalPipelineValue, winRate, wonValue, bySource, byFitScore, recentOutcomes };
}

// ── Email analytics ───────────────────────────────────────────────────

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

export interface EmailAnalytics {
  sent: number;
  openRate: number;
  clickRate: number;
  monthlyTrend: Array<{ month: string; sent: number; opens: number; clicks: number }>;
}

export async function fetchEmailAnalytics(): Promise<EmailAnalytics> {
  const { data: drafts } = await queryEmailDrafts({ status: "sent" }, { pageSize: 500 });

  const sent  = drafts.length;
  const opens = drafts.reduce((s: number, d: EmailDraft) => s + (d.opens ?? 0), 0);
  const clicks = drafts.reduce((s: number, d: EmailDraft) => s + (d.clicks ?? 0), 0);
  const openRate  = sent > 0 ? Math.round((opens  / sent) * 100) : 0;
  const clickRate = sent > 0 ? Math.round((clicks / sent) * 100) : 0;

  const labels = buildLastSixMonths();
  const byMonth: Record<string, { sent: number; opens: number; clicks: number }> = {};
  for (const label of labels) byMonth[label] = { sent: 0, opens: 0, clicks: 0 };

  for (const draft of drafts) {
    if (!draft.sentAt) continue;
    const label = toMonthLabel(draft.sentAt);
    if (byMonth[label]) {
      byMonth[label].sent   += 1;
      byMonth[label].opens  += draft.opens  ?? 0;
      byMonth[label].clicks += draft.clicks ?? 0;
    }
  }

  const monthlyTrend = labels.map((month) => ({ month, ...byMonth[month] }));
  return { sent, openRate, clickRate, monthlyTrend };
}
