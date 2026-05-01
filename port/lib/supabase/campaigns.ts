/**
 * Supabase read layer for campaigns.
 *
 * `id` is set to `notion_page_id` (not UUID) so callers that match
 * against Notion relation arrays continue to work unchanged.
 */

import { supabase } from "./client";

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

export interface CampaignFromSupabase {
  id: string;
  name: string;
  type: string | null;
  status: string | null;
  eventIds: string[];
  audienceFilters: Record<string, unknown>;
  owner: string | null;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
}

function mapRowToCampaign(row: CampaignRow): CampaignFromSupabase {
  return {
    id: row.notion_page_id,
    name: row.name,
    type: row.type,
    status: row.status,
    eventIds: row.event_ids ?? [],
    audienceFilters: row.audience_filters ?? {},
    owner: row.owner,
    startDate: row.start_date,
    endDate: row.end_date,
    notes: row.notes,
  };
}

const SELECT_COLS =
  "notion_page_id, name, type, status, event_ids, audience_filters, owner, start_date, end_date, notes";

export async function getCampaignsFromSupabase(
  status?: string,
  type?: string,
): Promise<CampaignFromSupabase[]> {
  let query = supabase.from("campaigns").select(SELECT_COLS).order("name", { ascending: true });

  if (status) query = query.eq("status", status);
  if (type) query = query.eq("type", type);

  const { data, error } = await query;
  if (error) throw new Error(`[supabase/campaigns] getCampaigns: ${error.message}`);
  return (data as CampaignRow[]).map(mapRowToCampaign);
}
