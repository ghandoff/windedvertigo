/**
 * Supabase read layer for campaign blueprints.
 *
 * GET reads come here instead of Notion — faster, no rate limits.
 * Blueprints are write-rare (structure templates), so the Notion-first
 * model and sync cron are a natural fit.
 */

import { supabase } from "@/lib/supabase/client";
import type { Blueprint } from "@/lib/notion/types";

export interface BlueprintSupabaseFilters {
  category?: string;
  channel?: string;
  search?: string;
}

interface BlueprintPagination {
  page?: number;
  pageSize?: number;
}

interface BlueprintRow {
  notion_page_id: string;
  name: string;
  description: string | null;
  channels: string[];
  category: string | null;
  step_count: number;
  total_days: number;
  notes: string | null;
  updated_at: string;
}

function rowToBlueprint(row: BlueprintRow): Blueprint {
  return {
    id: row.notion_page_id,
    name: row.name,
    description: row.description ?? "",
    channels: (row.channels ?? []) as Blueprint["channels"],
    category: (row.category ?? "") as Blueprint["category"],
    stepCount: row.step_count ?? 0,
    totalDays: row.total_days ?? 0,
    notes: row.notes ?? "",
    createdTime: row.updated_at,
  };
}

export async function getBlueprintsFromSupabase(
  filters: BlueprintSupabaseFilters = {},
  pagination: BlueprintPagination = {},
): Promise<{ data: Blueprint[]; total: number }> {
  const { page = 1, pageSize = 50 } = pagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("blueprints").select("*", { count: "exact" });

  if (filters.category) q = q.eq("category", filters.category);
  if (filters.channel) q = q.contains("channels", [filters.channel]);
  if (filters.search) q = q.ilike("name", `%${filters.search}%`);

  q = q.order("name", { ascending: true }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    data: (data as unknown as BlueprintRow[]).map(rowToBlueprint),
    total: count ?? 0,
  };
}

export async function getBlueprintByIdFromSupabase(notionPageId: string): Promise<Blueprint | null> {
  const { data, error } = await supabase
    .from("blueprints")
    .select("*")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return rowToBlueprint(data as unknown as BlueprintRow);
}
