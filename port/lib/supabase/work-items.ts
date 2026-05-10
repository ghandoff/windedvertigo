/**
 * Supabase read layer for work_items — used by the agent's queryWorkItemsTool.
 *
 * Arrays (owner_ids, project_ids, etc.) are stored as TEXT[] in Postgres,
 * so no split/join needed. `id` is set to `notion_page_id` so all callers
 * that reference Notion IDs continue to work unchanged.
 */

import { supabase } from "./client";
import type { WorkItem } from "@/lib/notion/types";

interface WorkItemRow {
  notion_page_id: string;
  task: string;
  status: string | null;
  task_type: string | null;
  priority: string | null;
  owner_ids: string[];
  person_ids: string[];
  project_ids: string[];
  milestone_ids: string[];
  parent_task_ids: string[];
  sub_task_ids: string[];
  blocking_ids: string[];
  blocked_by_ids: string[];
  timesheet_ids: string[];
  meeting_ids: string[];
  due_date: string | null;
  estimate_hours: number | null;
  archive: boolean;
}

function mapRowToWorkItem(row: WorkItemRow): WorkItem {
  return {
    id: row.notion_page_id,
    task: row.task,
    status: (row.status as WorkItem["status"]) ?? "in queue",
    taskType: (row.task_type as WorkItem["taskType"]) ?? null,
    priority: (row.priority as WorkItem["priority"]) ?? null,
    ownerIds: row.owner_ids ?? [],
    personIds: row.person_ids ?? [],
    projectIds: row.project_ids ?? [],
    milestoneIds: row.milestone_ids ?? [],
    parentTaskIds: row.parent_task_ids ?? [],
    subTaskIds: row.sub_task_ids ?? [],
    blockingIds: row.blocking_ids ?? [],
    blockedByIds: row.blocked_by_ids ?? [],
    timesheetIds: row.timesheet_ids ?? [],
    meetingIds: row.meeting_ids ?? [],
    dueDate: row.due_date ? { start: row.due_date, end: null } : null,
    estimateHours: row.estimate_hours ?? null,
    archive: row.archive ?? false,
    createdTime: "",
    lastEditedTime: "",
  };
}

const SELECT_COLS =
  "notion_page_id, task, status, task_type, priority, owner_ids, person_ids, project_ids, milestone_ids, parent_task_ids, sub_task_ids, blocking_ids, blocked_by_ids, timesheet_ids, meeting_ids, due_date, estimate_hours, archive";

export async function getWorkItemsFromSupabase(
  status?: string,
  ownerId?: string,
  projectId?: string,
  archive?: boolean,
): Promise<WorkItem[]> {
  let query = supabase.from("work_items").select(SELECT_COLS);

  if (status) query = query.eq("status", status);
  if (ownerId) query = query.contains("owner_ids", [ownerId]);
  if (projectId) query = query.contains("project_ids", [projectId]);
  if (archive !== undefined) query = query.eq("archive", archive);

  const { data, error } = await query;

  if (error)
    throw new Error(`[supabase/work-items] getWorkItemsFromSupabase: ${error.message}`);
  return (data as WorkItemRow[]).map(mapRowToWorkItem);
}

export async function getWorkItemByIdFromSupabase(
  notionPageId: string,
): Promise<WorkItem | null> {
  const { data, error } = await supabase
    .from("work_items")
    .select(SELECT_COLS)
    .eq("notion_page_id", notionPageId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`[supabase/work-items] getById: ${error.message}`);
  }
  return data ? mapRowToWorkItem(data as WorkItemRow) : null;
}

// ── write functions ───────────────────────────────────────────────

/**
 * Upsert a work item. Uses notion_page_id as the conflict target.
 */
export async function upsertWorkItemToSupabase(
  notionPageId: string,
  data: Partial<Omit<WorkItemRow, "notion_page_id">>,
): Promise<void> {
  const { error } = await supabase
    .from("work_items")
    .upsert({ notion_page_id: notionPageId, ...data }, { onConflict: "notion_page_id" });
  if (error) throw new Error(`[supabase/work-items] upsert: ${error.message}`);
}

/**
 * Create a new port-native work item with a synthetic `wv-ect-{uuid}` PK.
 * Returns the generated notion_page_id so callers can reference it.
 *
 * Phase 14 — used by EventContactsPanel to auto-create follow-up tasks
 * whenever a contact is marked as "met" at an event.
 */
export async function createWorkItem(input: {
  task: string;
  status?: WorkItemRow["status"];
  dueDate?: string; // YYYY-MM-DD
}): Promise<string> {
  const notionPageId = `wv-ect-${crypto.randomUUID()}`;
  const { error } = await supabase.from("work_items").insert({
    notion_page_id: notionPageId,
    task: input.task,
    status: input.status ?? "in queue",
    due_date: input.dueDate ?? null,
  });
  if (error) throw new Error(`[supabase/work-items] createWorkItem: ${error.message}`);
  return notionPageId;
}

/**
 * Delete a work item row.
 */
export async function deleteWorkItemFromSupabase(notionPageId: string): Promise<void> {
  const { error } = await supabase
    .from("work_items")
    .delete()
    .eq("notion_page_id", notionPageId);
  if (error) throw new Error(`[supabase/work-items] delete: ${error.message}`);
}
