/**
 * Supabase read layer for deals — used when DEALS_SOURCE=supabase.
 *
 * Maps Supabase rows back to the canonical `Deal` type from lib/notion/types.
 * Critically: `id` is set to `notion_page_id` (not the Supabase UUID) so all
 * callers that match against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { Deal, DealStage, DealLostReason } from "@/lib/notion/types";

interface DealRow {
  notion_page_id: string;
  deal: string;
  stage: string | null;
  value: number | null;
  org_ids: string[];
  rfp_ids: string[];
  notes: string | null;
  loss_reason: string | null;
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
  };
}

const SELECT_COLS =
  "notion_page_id, deal, stage, value, org_ids, rfp_ids, notes, loss_reason";

export async function getDealsFromSupabase(
  stage?: DealStage,
  orgId?: string,
): Promise<Deal[]> {
  let query = supabase.from("deals").select(SELECT_COLS);

  if (stage) {
    query = query.eq("stage", stage);
  }
  if (orgId) {
    query = query.contains("org_ids", [orgId]);
  }

  const { data, error } = await query;

  if (error) throw new Error(`[supabase/deals] getDeals: ${error.message}`);
  return (data as DealRow[]).map(mapRowToDeal);
}
