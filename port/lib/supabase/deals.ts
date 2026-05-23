/**
 * Supabase read layer for deals — used when DEALS_SOURCE=supabase.
 *
 * Maps Supabase rows back to the canonical `Deal` type from lib/notion/types.
 * Critically: `id` is set to `notion_page_id` (not the Supabase UUID) so all
 * callers that match against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { Deal, DealStage, DealLostReason, RevenueTier } from "@/lib/notion/types";

interface DealRow {
  notion_page_id: string;
  deal: string;
  stage: string | null;
  value: number | null;
  org_ids: string[];
  rfp_ids: string[];
  notes: string | null;
  loss_reason: string | null;
  // Revenue-pipeline fields (added 2026-05-23 migration)
  revenue_tier: string | null;
  received_amount: number | null;
  contracted_amount: number | null;
}

function mapRowToDeal(row: DealRow): Deal {
  return {
    id: row.notion_page_id,
    deal: row.deal,
    stage: (row.stage as DealStage) ?? "identified",
    organizationIds: row.org_ids ?? [],
    rfpOpportunityIds: row.rfp_ids ?? [],
    owner: "",
    value: row.value ?? null,
    closeDate: null,
    lostReason: (row.loss_reason as DealLostReason) ?? null,
    notes: row.notes ?? "",
    documents: undefined,
    debriefWhatWorked: "",
    debriefWhatFellFlat: "",
    debriefWhatWasMissing: "",
    debriefClientFeedback: "",
    createdTime: "",
    lastEditedTime: "",
    revenueTier: (row.revenue_tier as RevenueTier) ?? null,
    receivedAmount: row.received_amount ?? 0,
    contractedAmount: row.contracted_amount ?? null,
  };
}

const SELECT_COLS =
  "notion_page_id, deal, stage, value, org_ids, rfp_ids, notes, loss_reason, revenue_tier, received_amount, contracted_amount";

export async function getDealsFromSupabase(
  stage?: DealStage,
  orgId?: string,
  search?: string,
): Promise<Deal[]> {
  let query = supabase.from("deals").select(SELECT_COLS).order("deal", { ascending: true });

  if (stage) {
    query = query.eq("stage", stage);
  }
  if (orgId) {
    query = query.contains("org_ids", [orgId]);
  }
  if (search) {
    query = query.ilike("deal", `%${search}%`);
  }

  const { data, error } = await query;

  if (error) throw new Error(`[supabase/deals] getDeals: ${error.message}`);
  return (data as DealRow[]).map(mapRowToDeal);
}

/**
 * Fetch a single deal by its Notion page id.
 */
export async function getDealByIdFromSupabase(
  notionPageId: string,
): Promise<Deal | null> {
  const { data, error } = await supabase
    .from("deals")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/deals] getById: ${error.message}`);
  }
  return data ? mapRowToDeal(data as DealRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert a deal. Uses notion_page_id as the conflict target.
 */
export async function upsertDealToSupabase(
  notionPageId: string,
  data: Partial<Omit<DealRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("deals")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/deals] upsert: ${error.message}`);
}

/**
 * Delete a deal row.
 */
export async function deleteDealFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("deals")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/deals] delete: ${error.message}`);
}

/**
 * Fetch deals that have been placed in the revenue pipeline by the CMO.
 *
 * Only returns rows where `revenue_tier IS NOT NULL` and `stage != 'lost'`.
 * Used by fetchRevenueProgress() to build the StrategyHero confidence bar.
 */
export async function getRevenuePipelineDeals(): Promise<Deal[]> {
  const { data, error } = await supabase
    .from("deals")
    .select(SELECT_COLS)
    .not("revenue_tier", "is", null)
    .neq("stage", "lost")
    .order("deal", { ascending: true });

  if (error) throw new Error(`[supabase/deals] getRevenuePipelineDeals: ${error.message}`);
  return (data as DealRow[]).map(mapRowToDeal);
}

/**
 * Update only the revenue-tier fields for a deal.
 * Used by PATCH /api/deals/[id]/revenue.
 */
export async function updateDealRevenue(
  notionPageId: string,
  fields: {
    revenue_tier?: RevenueTier | null;
    received_amount?: number;
    contracted_amount?: number | null;
  },
): Promise<void> {
  const { error } = await supabase
    .from("deals")
    .update(fields)
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/deals] updateDealRevenue: ${error.message}`);
}
