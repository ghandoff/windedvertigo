/**
 * Supabase read layer for cycles.
 *
 * GET reads come here instead of Notion — faster, no rate limits.
 * Writes still go to Notion (source of truth); sync cron mirrors within 2h.
 */

import { supabase } from "@/lib/supabase/client";
import type { Cycle } from "@/lib/notion/types";

export interface CycleSupabaseFilters {
  status?: string;
  projectId?: string;
  search?: string;
}

interface CyclePagination {
  page?: number;
  pageSize?: number;
}

interface CycleRow {
  notion_page_id: string;
  cycle: string;
  start_date: string | null;
  end_date: string | null;
  project_ids: string[];
  status: string | null;
  goal: string | null;
  updated_at: string;
}

function rowToCycle(row: CycleRow): Cycle {
  return {
    id: row.notion_page_id,
    cycle: row.cycle,
    startDate: row.start_date ? { start: row.start_date, end: null } : null,
    endDate: row.end_date ? { start: row.end_date, end: null } : null,
    projectIds: row.project_ids ?? [],
    status: (row.status ?? null) as Cycle["status"],
    goal: row.goal ?? "",
    createdTime: row.updated_at,
    lastEditedTime: row.updated_at,
  };
}

export async function getCyclesFromSupabase(
  filters: CycleSupabaseFilters = {},
  pagination: CyclePagination = {},
): Promise<{ data: Cycle[]; total: number }> {
  const { page = 1, pageSize = 50 } = pagination;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let q = supabase.from("cycles").select("*", { count: "exact" });

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.projectId) q = q.contains("project_ids", [filters.projectId]);
  if (filters.search) q = q.ilike("cycle", `%${filters.search}%`);

  q = q.order("start_date", { ascending: false }).range(from, to);

  const { data, error, count } = await q;
  if (error) throw error;

  return {
    data: (data as unknown as CycleRow[]).map(rowToCycle),
    total: count ?? 0,
  };
}

export async function getCycleByIdFromSupabase(notionPageId: string): Promise<Cycle | null> {
  const { data, error } = await supabase
    .from("cycles")
    .select("*")
    .eq("notion_page_id", notionPageId)
    .maybeSingle();

  if (error && error.code !== "PGRST116") throw error;
  if (!data) return null;
  return rowToCycle(data as unknown as CycleRow);
}
