/**
 * Supabase read layer for milestones.
 *
 * Filter parity with lib/notion/milestones.ts queryMilestones():
 * - kind, milestoneStatus → direct column match
 * - projectId → contains("project_ids", [value])
 * - clientVisible → boolean column
 * - includeArchived → false means archive = false filter; true = no filter
 * - search → ILIKE '%value%' on milestone name
 *
 * Phase G.1.3: GET /api/milestones now reads from Supabase.
 * POST still writes to Notion — source of truth.
 */

import { supabase } from "./client";
import type { Milestone } from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────────────

interface MilestoneRow {
  notion_page_id: string;
  milestone: string;
  kind: string | null;
  milestone_status: string | null;
  project_ids: string[];
  task_ids: string[];
  owner_ids: string[];
  start_date: string | null;
  end_date: string | null;
  client_visible: boolean;
  description: string | null;
  brief: string | null;
  billing_total: number | null;
  archive: boolean;
}

export interface MilestoneSupabaseFilters {
  kind?: string;
  milestoneStatus?: string;
  projectId?: string;
  clientVisible?: boolean;
  includeArchived?: boolean;
  search?: string;
}

export interface MilestoneSupabasePagination {
  page?: number;
  pageSize?: number;
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToMilestone(row: MilestoneRow): Milestone {
  return {
    id: row.notion_page_id,
    milestone: row.milestone,
    kind: (row.kind as Milestone["kind"]) ?? "milestone",
    milestoneStatus: (row.milestone_status as Milestone["milestoneStatus"]) ?? "not started",
    projectIds: row.project_ids ?? [],
    taskIds: row.task_ids ?? [],
    ownerIds: row.owner_ids ?? [],
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    clientVisible: row.client_visible ?? false,
    description: row.description ?? "",
    brief: row.brief ?? "",
    billingTotal: row.billing_total ?? null,
    archive: row.archive ?? false,
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, milestone, kind, milestone_status, project_ids, task_ids, owner_ids, " +
  "start_date, end_date, client_visible, description, brief, billing_total, archive";

// ── query functions ───────────────────────────────────────────────

export async function getMilestonesFromSupabase(
  filters: MilestoneSupabaseFilters = {},
  pagination: MilestoneSupabasePagination = {},
): Promise<{ data: Milestone[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("milestones")
    .select(SELECT_COLS, { count: "exact" })
    .order("milestone", { ascending: true })
    .range(from, to);

  if (filters.kind)            query = query.eq("kind", filters.kind);
  if (filters.milestoneStatus) query = query.eq("milestone_status", filters.milestoneStatus);
  if (filters.projectId)       query = query.contains("project_ids", [filters.projectId]);
  if (filters.clientVisible !== undefined) query = query.eq("client_visible", filters.clientVisible);
  if (!filters.includeArchived) query = query.eq("archive", false);
  if (filters.search)          query = query.ilike("milestone", `%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/milestones] query: ${error.message}`);
  return {
    data: (data as unknown as MilestoneRow[]).map(mapRowToMilestone),
    total: count ?? 0,
  };
}

/**
 * Fetch a single milestone by its Notion page id.
 */
export async function getMilestoneByIdFromSupabase(
  notionPageId: string,
): Promise<Milestone | null> {
  const { data, error } = await supabase
    .from("milestones")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/milestones] getById: ${error.message}`);
  }
  return data ? mapRowToMilestone(data as unknown as MilestoneRow) : null;
}
