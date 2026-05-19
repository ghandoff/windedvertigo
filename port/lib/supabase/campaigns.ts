/**
 * Supabase read layer for campaigns.
 *
 * Returns the canonical Notion `Campaign` type so all existing components
 * work without modification.
 *
 * `id` is set to `notion_page_id` (not UUID) so callers that match
 * against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";
import type { Campaign, CampaignType, CampaignStatus, AudienceFilter } from "@/lib/notion/types";

interface CampaignRow {
  notion_page_id: string;
  name: string;
  type: string | null;
  status: string | null;
  event_ids: string[] | null;
  audience_filters: Record<string, unknown> | null;
  owner: string | null;
  start_date: string | null;
  end_date: string | null;
  notes: string | null;
}

function mapRowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.notion_page_id,
    name: row.name,
    type: (row.type as CampaignType) ?? "email",
    status: (row.status as CampaignStatus) ?? "draft",
    eventIds: row.event_ids ?? [],
    audienceFilters: (row.audience_filters as AudienceFilter) ?? {},
    owner: row.owner ?? "",
    startDate: row.start_date ? { start: row.start_date, end: null } : null,
    endDate: row.end_date ? { start: row.end_date, end: null } : null,
    notes: row.notes ?? "",
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, name, type, status, event_ids, audience_filters, owner, start_date, end_date, notes";

export async function getCampaignsFromSupabase(
  status?: string,
  type?: string,
  search?: string,
  options?: { includeComplete?: boolean },
): Promise<Campaign[]> {
  let query = supabase.from("campaigns").select(SELECT_COLS).order("name", { ascending: true });

  if (status) {
    query = query.eq("status", status);
  } else if (!options?.includeComplete) {
    // Default: hide completed campaigns from the board (they clutter the kanban).
    // Pass { includeComplete: true } or an explicit status to override.
    query = query.neq("status", "complete");
  }
  if (type)   query = query.eq("type", type);
  if (search) query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) throw new Error(`[supabase/campaigns] getCampaigns: ${error.message}`);
  return (data as CampaignRow[]).map(mapRowToCampaign);
}

/**
 * Fetch a single campaign by its Notion page id.
 */
export async function getCampaignByIdFromSupabase(
  notionPageId: string,
): Promise<Campaign | null> {
  const { data, error } = await supabase
    .from("campaigns")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/campaigns] getById: ${error.message}`);
  }
  return data ? mapRowToCampaign(data as CampaignRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert a campaign. Uses notion_page_id as the conflict target.
 */
export async function upsertCampaignToSupabase(
  notionPageId: string,
  data: Partial<Omit<CampaignRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/campaigns] upsert: ${error.message}`);
}

/**
 * Delete a campaign row.
 */
export async function deleteCampaignFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("campaigns")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/campaigns] delete: ${error.message}`);
}
