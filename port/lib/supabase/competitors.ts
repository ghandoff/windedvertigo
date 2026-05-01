/**
 * Supabase read layer for competitors.
 *
 * GET reads come here instead of Notion — faster, no rate limits.
 * Writes still go to Notion (source of truth); sync cron mirrors within 6h.
 */

import { supabase } from "@/lib/supabase/client";
import type { Competitor } from "@/lib/notion/types";

export interface CompetitorSupabaseFilters {
  type?: string;
  threatLevel?: string;
  quadrantOverlap?: string;
  geography?: string;
  search?: string;
}

interface CompetitorPagination {
  page?: number;
  pageSize?: number;
}

interface CompetitorRow {
  notion_page_id: string;
  organisation: string;
  type: string | null;
  threat_level: string | null;
  quadrant_overlap: string[];
  geography: string[];
  what_they_offer: string | null;
  where_wv_wins: string | null;
  relevance_to_wv: string | null;
  notes: string | null;
  url: string | null;
  organization_ids: string[];
  updated_at: string;
}

function rowToCompetitor(row: CompetitorRow): Competitor {
  return {
    id: row.notion_page_id,
    organisation: row.organisation,
    type: (row.type ?? "") as Competitor["type"],
    threatLevel: (row.threat_level ?? "") as Competitor["threatLevel"],
    quadrantOverlap: (row.quadrant_overlap ?? []) as Competitor["quadrantOverlap"],
    geography: (row.geography ?? []) as Competitor["geography"],
    whatTheyOffer: row.what_they_offer ?? "",
    whereWvWins: row.where_wv_wins ?? "",
    relevanceToWv: row.relevance_to_wv ?? "",
    notes: row.notes ?? "",
    url: row.url ?? "",
    organizationIds: row.organization_ids ?? [],
    lastEditedTime: row.updated_at,
  };
}

export async function getCompetitorsFromSupabase(
  filters: CompetitorSupabaseFilters = {},
  pagination: CompetitorPagination = {},
): Promise<{ data: Competitor[]; total: number }> {
  const { page = 1, pageSize = 50 } = pagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("competitors").select("*", { count: "exact" });

  if (filters.type) q = q.eq("type", filters.type);
  if (filters.threatLevel) q = q.eq("threat_level", filters.threatLevel);
  if (filters.quadrantOverlap) q = q.contains("quadrant_overlap", [filters.quadrantOverlap]);
  if (filters.geography) q = q.contains("geography", [filters.geography]);
  if (filters.search) q = q.ilike("organisation", `%${filters.search}%`);

  q = q.order("updated_at", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    data: (data as unknown as CompetitorRow[]).map(rowToCompetitor),
    total: count ?? 0,
  };
}

export async function getCompetitorByIdFromSupabase(notionPageId: string): Promise<Competitor | null> {
  const { data, error } = await supabase
    .from("competitors")
    .select("*")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return rowToCompetitor(data as unknown as CompetitorRow);
}
