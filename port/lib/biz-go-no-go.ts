/**
 * Biz go/no-go inputs — assembles the facts the agent needs to score a
 * bid/no-bid/defer decision: opportunity, eligibility requirements, fit, value,
 * deadline, a formula win-probability, and any existing decision. Read-only.
 */

import { getRfpOpportunityByIdFromSupabase } from "./supabase/rfp-opportunities";
import { getRequirementsByRfp } from "./supabase/rfp-requirements";
import { supabase } from "./supabase/client";
import type { RfpOpportunity } from "./notion/types";

/**
 * Formula win-probability (0–95) from existing RFP fields — no AI call.
 * Mirrors app/components/ai-win-probability.ts computeWinProbability(); kept in
 * sync here so server code doesn't import the client component module.
 */
export function winProbability(rfp: RfpOpportunity): number {
  let score = 30;
  if (rfp.wvFitScore === "high fit") score += 25;
  else if (rfp.wvFitScore === "medium fit") score += 10;
  else if (rfp.wvFitScore === "low fit") score -= 10;

  if (rfp.serviceMatch.length >= 3) score += 15;
  else if (rfp.serviceMatch.length >= 1) score += 5;

  if (rfp.status === "interviewing") score += 15;
  else if (rfp.status === "submitted") score += 10;
  else if (rfp.status === "pursuing") score += 5;

  if (rfp.estimatedValue && rfp.estimatedValue > 500_000) score -= 5;

  return Math.max(5, Math.min(95, score));
}

export interface GoNoGoInputs {
  rfp_id: string;
  name: string;
  status: string;
  type: string;
  fit: string;
  estimated_value: number | null;
  due_date: string | null;
  days_to_deadline: number | null;
  service_match: string[];
  geography: string[];
  win_probability: number;
  eligibility: Array<{ label: string; required: boolean; source_quote: string | null }>;
  current_decision: { decision: string | null; score: number | null; reason: string | null };
  tor_snapshot: string | null;
}

export async function getGoNoGoInputs(rfpId: string): Promise<GoNoGoInputs | null> {
  const opp = await getRfpOpportunityByIdFromSupabase(rfpId);
  if (!opp) return null;

  const [requirements, decisionRow] = await Promise.all([
    getRequirementsByRfp(rfpId).catch(() => []),
    (async () => {
      try {
        const { data } = await supabase
          .from("rfp_opportunities")
          .select("bid_decision, bid_decision_score, bid_decision_reason")
          .eq("notion_page_id", rfpId)
          .maybeSingle();
        return data as { bid_decision: string | null; bid_decision_score: number | null; bid_decision_reason: string | null } | null;
      } catch {
        return null;
      }
    })(),
  ]);
  const eligibility = requirements
    .filter((r) => r.kind === "eligibility")
    .map((r) => ({ label: r.label, required: r.required, source_quote: r.sourceQuote }));

  const due = opp.dueDate?.start ?? null;
  const days = due ? Math.ceil((new Date(due).getTime() - Date.now()) / 86_400_000) : null;

  return {
    rfp_id: rfpId,
    name: opp.opportunityName,
    status: opp.status,
    type: opp.opportunityType,
    fit: opp.wvFitScore,
    estimated_value: opp.estimatedValue,
    due_date: due,
    days_to_deadline: days,
    service_match: opp.serviceMatch,
    geography: opp.geography,
    win_probability: winProbability(opp),
    eligibility,
    current_decision: {
      decision: decisionRow?.bid_decision ?? null,
      score: decisionRow?.bid_decision_score ?? null,
      reason: decisionRow?.bid_decision_reason ?? null,
    },
    tor_snapshot: opp.requirementsSnapshot || null,
  };
}
