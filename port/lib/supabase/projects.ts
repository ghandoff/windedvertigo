/**
 * Supabase read layer for projects.
 *
 * Filter parity with lib/notion/projects.ts queryProjects():
 * - status, priority, type → direct column match
 * - archive → boolean column
 * - search → ILIKE '%value%' on project name
 *
 * Phase G.1.3: GET /api/projects now reads from Supabase.
 * POST still writes to Notion — source of truth.
 */

import { supabase } from "./client";
import type { Project } from "@/lib/notion/types";

// ── types ────────────────────────────────────────────────────────

interface ProjectRow {
  notion_page_id: string;
  project: string;
  status: string | null;
  priority: string | null;
  type: string | null;
  budget_hours: number | null;
  event_type: string | null;
  timeline_start: string | null;
  timeline_end: string | null;
  project_lead_ids: string[];
  organization_ids: string[];
  milestone_ids: string[];
  task_ids: string[];
  cycle_ids: string[];
  archive: boolean;
}

export interface ProjectSupabaseFilters {
  status?: string;
  priority?: string;
  type?: string;
  archive?: boolean;
  search?: string;
}

export interface ProjectSupabasePagination {
  page?: number;
  pageSize?: number;
}

// ── helpers ──────────────────────────────────────────────────────

function mapRowToProject(row: ProjectRow): Project {
  const timeline = (row.timeline_start || row.timeline_end)
    ? { start: row.timeline_start ?? "", end: row.timeline_end ?? null }
    : null;

  return {
    id: row.notion_page_id,
    project: row.project,
    status: (row.status as Project["status"]) ?? "planning",
    priority: (row.priority as Project["priority"]) ?? "medium",
    type: (row.type as Project["type"]) ?? null,
    budgetHours: row.budget_hours ?? null,
    eventType: row.event_type ?? "",
    timeline,
    dateAndTime: null,
    projectLeadIds: row.project_lead_ids ?? [],
    organizationIds: row.organization_ids ?? [],
    milestoneIds: row.milestone_ids ?? [],
    taskIds: row.task_ids ?? [],
    cycleIds: row.cycle_ids ?? [],
    archive: row.archive ?? false,
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, project, status, priority, type, budget_hours, event_type, " +
  "timeline_start, timeline_end, project_lead_ids, organization_ids, milestone_ids, " +
  "task_ids, cycle_ids, archive";

// ── query functions ───────────────────────────────────────────────

export async function getProjectsFromSupabase(
  filters: ProjectSupabaseFilters = {},
  pagination: ProjectSupabasePagination = {},
): Promise<{ data: Project[]; total: number }> {
  const page = Math.max(1, pagination.page ?? 1);
  const pageSize = Math.min(500, Math.max(1, pagination.pageSize ?? 100));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("projects")
    .select(SELECT_COLS, { count: "exact" })
    .order("project", { ascending: true })
    .range(from, to);

  if (filters.status)  query = query.eq("status", filters.status);
  if (filters.priority) query = query.eq("priority", filters.priority);
  if (filters.type)    query = query.eq("type", filters.type);
  if (filters.archive !== undefined) query = query.eq("archive", filters.archive);
  if (filters.search)  query = query.ilike("project", `%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw new Error(`[supabase/projects] query: ${error.message}`);
  return {
    data: (data as unknown as ProjectRow[]).map(mapRowToProject),
    total: count ?? 0,
  };
}

/**
 * Fetch a single project by its Notion page id.
 */
export async function getProjectByIdFromSupabase(
  notionPageId: string,
): Promise<Project | null> {
  const { data, error } = await supabase
    .from("projects")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/projects] getById: ${error.message}`);
  }
  return data ? mapRowToProject(data as unknown as ProjectRow) : null;
}
