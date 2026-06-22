/**
 * fetchRevenueProgress() — live revenue-bar data for the StrategyHero.
 *
 * Merges two data sources into a RevenueProgressInput:
 *
 *   Source A — deals with revenue_tier set (relationship wins, signed contracts)
 *   Source B — active RFPs not yet converted to a deal (open proposals)
 *
 * De-duplication: RFP rows whose notion_page_id appears in any deal's rfp_ids
 * array are excluded from Source B — the deal is the source of truth once a
 * relationship has been formalised.
 *
 * Revenue-tier mapping from DB fields to RevenueProgressInput status strings:
 *   deals:  revenue_tier "signed"      → status "signed"
 *           revenue_tier "advanced"    → status "in-progress"
 *           revenue_tier "negotiation" → status "negotiation"
 *           revenue_tier "open"        → status "documentation"
 *   rfps:   status "interviewing"      → status "negotiation"
 *           status "submitted"         → status "documentation"
 *
 * Only "submitted"/"interviewing" RFPs count toward the bar — i.e. a proposal is
 * actually out and awaiting a decision. "pursuing" (early-radar, still deciding
 * whether/how to bid) is excluded: it's too speculative for a progress-to-target
 * figure and let large moonshot grants (e.g. an $8M Gates RFP) saturate the bar.
 *
 * Falls back to REVENUE_PROGRESS (hardcoded constant) on any error — the
 * caller wraps this in .catch(() => REVENUE_PROGRESS).
 */

import { getRevenuePipelineDeals } from "@/lib/supabase/deals";
import { supabase } from "@/lib/supabase/client";
import { REVENUE_TARGET } from "@/lib/strategy-data";
import type { RevenueProgressInput } from "@/lib/strategy-data";
import type { RfpOpportunity } from "@/lib/notion/types";

// Statuses that count toward the progress-to-target bar: a proposal is out and
// awaiting a decision. "pursuing" is deliberately excluded (early-radar/speculative).
const ACTIVE_RFP_STATUSES = new Set(["interviewing", "submitted"]);

function rfpStatusToProgressStatus(status: string): string {
  if (status === "interviewing") return "negotiation";
  return "documentation";
}

function dealTierToProgressStatus(tier: string): string {
  if (tier === "signed") return "signed";
  if (tier === "advanced") return "in-progress";
  if (tier === "negotiation") return "negotiation";
  return "documentation"; // "open" and anything else
}

export async function fetchRevenueProgress(): Promise<RevenueProgressInput> {
  // ── Source A: deals with revenue_tier set ─────────────────────────────
  const deals = await getRevenuePipelineDeals();

  // Build a set of all RFP notion_page_ids that are already represented by a
  // deal (used below to de-duplicate Source B)
  const dealtRfpIds = new Set<string>();
  for (const deal of deals) {
    for (const rfpId of deal.rfpOpportunityIds) {
      dealtRfpIds.add(rfpId);
    }
  }

  const dealRows: RevenueProgressInput["breakdown"][number][] = deals.map((d) => ({
    client: d.deal,
    amount: d.contractedAmount ?? d.value ?? 0,
    status: dealTierToProgressStatus(d.revenueTier ?? "open"),
    receivedAmount: d.receivedAmount > 0 ? d.receivedAmount : undefined,
    // No `detail` field — deals use the deal name as their full identifier
  }));

  // ── Source B: active RFPs not yet linked to a deal ────────────────────
  const { data: rfpData } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, status, estimated_value")
    .in("status", [...ACTIVE_RFP_STATUSES])
    .not("estimated_value", "is", null);

  const rfpRows: RevenueProgressInput["breakdown"][number][] = (
    (rfpData as Array<{
      notion_page_id: string;
      opportunity_name: string;
      status: string;
      estimated_value: number | null;
    }> | null) ?? []
  )
    .filter((r) => !dealtRfpIds.has(r.notion_page_id))
    .map((r) => ({
      client: r.opportunity_name,
      amount: r.estimated_value ?? 0,
      status: rfpStatusToProgressStatus(r.status),
    }));

  return {
    target: REVENUE_TARGET,
    breakdown: [...dealRows, ...rfpRows],
  };
}
