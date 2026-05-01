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
): Promise<WorkItem[]> {
  let query = supabase.from("work_items").select(SELECT_COLS);

  if (status) query = query.eq("status", status);
  if (ownerId) query = query.contains("owner_ids", [ownerId]);
  if (projectId) query = query.contains("project_ids", [projectId]);

  const { data, error } = await query;

  if (error)
    throw new Error(`[supabase/work-items] getWorkItemsFromSupabase: ${error.message}`);
  return (data as WorkItemRow[]).map(mapRowToWorkItem);
}
