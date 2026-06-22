/**
 * RFP → deal sync.
 *
 * The /strategy revenue chart reads `deals` (revenue_tier set) + active RFPs.
 * Historically deals were a manual store disconnected from RFP Radar, so winning
 * an RFP never produced a deal and the two diverged. This closes that loop:
 * when an opportunity moves to "won", ensure it is represented as a signed,
 * linked deal in the revenue pipeline.
 *
 * Linking via `rfp_ids` is what makes the dedup in
 * lib/marketing/revenue-progress.ts fire — once a deal carries the RFP id, the
 * RFP drops out of Source B so the opportunity is counted exactly once.
 */

import type { RfpOpportunity } from "@/lib/notion/types";
import {
  getDealByRfpId,
  findDealByName,
  upsertDealToSupabase,
  insertDealEvent,
} from "@/lib/supabase/deals";

export interface SyncWonRfpResult {
  action: "updated" | "created";
  dealKey: string;
}

/**
 * Ensure a won RFP is a signed, linked deal. Idempotent: re-running on an
 * already-synced RFP just re-asserts the same fields.
 *
 * - If a deal is already linked (rfp_ids contains the RFP id) or matches by name,
 *   update it to signed/won and ensure the link.
 * - Otherwise create a new deal keyed `rfp-deal:<rfpId>`.
 */
export async function syncWonRfpToDeal(
  rfpId: string,
  rfp: Pick<RfpOpportunity, "opportunityName" | "estimatedValue" | "organizationIds">,
  triggeredBy?: string,
): Promise<SyncWonRfpResult> {
  const value = rfp.estimatedValue ?? null;
  const existing = (await getDealByRfpId(rfpId)) ?? (await findDealByName(rfp.opportunityName));
  const by = triggeredBy ? ` (by ${triggeredBy})` : "";

  if (existing) {
    const npid = existing.id; // mapRowToDeal sets id = notion_page_id
    const rfpIds = Array.from(new Set([...(existing.rfpOpportunityIds ?? []), rfpId]));
    await upsertDealToSupabase(npid, {
      stage: "won",
      revenue_tier: "signed",
      // keep an existing contracted figure if set; otherwise seed from the RFP value
      contracted_amount: existing.contractedAmount ?? value,
      origin_type: "rfp",
      rfp_ids: rfpIds,
    });
    await insertDealEvent(npid, {
      eventType: "contract_signed",
      oldValue: { stage: existing.stage, revenue_tier: existing.revenueTier },
      newValue: {
        stage: "won",
        revenue_tier: "signed",
        contracted_amount: existing.contractedAmount ?? value,
      },
      note: `won via RFP ${rfpId}${by}`,
    });
    return { action: "updated", dealKey: npid };
  }

  const npid = `rfp-deal:${rfpId}`;
  await upsertDealToSupabase(npid, {
    deal: rfp.opportunityName,
    stage: "won",
    value,
    contracted_amount: value,
    revenue_tier: "signed",
    origin_type: "rfp",
    org_ids: rfp.organizationIds ?? [],
    rfp_ids: [rfpId],
  });
  await insertDealEvent(npid, {
    eventType: "contract_signed",
    newValue: { stage: "won", revenue_tier: "signed", contracted_amount: value },
    note: `won via RFP ${rfpId} — auto-created${by}`,
  });
  return { action: "created", dealKey: npid };
}
