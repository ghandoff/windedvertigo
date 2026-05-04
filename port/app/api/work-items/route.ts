/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getWorkItemsFromSupabase,
  upsertWorkItemToSupabase,
} from "@/lib/supabase/work-items";
import { json, error, param, boolParam } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const status = param(req, "status") ?? undefined;
  const ownerId = param(req, "ownerId") ?? undefined;
  const projectId = param(req, "projectId") ?? undefined;
  const archive = boolParam(req, "archive") ?? undefined;

  try {
    const data = await getWorkItemsFromSupabase(status, ownerId, projectId, archive);
    return json({ data, nextCursor: null, hasMore: false });
  } catch (err) {
    console.error("[api/work-items] Supabase query failed:", err);
    return error("failed to load work items", 500);
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.task) return error("task (name) is required");

  try {
    const id = crypto.randomUUID();
    await upsertWorkItemToSupabase(id, {
      task: body.task,
      status: body.status ?? "in queue",
      task_type: body.taskType ?? null,
      priority: body.priority ?? null,
      owner_ids: body.ownerIds ?? [],
      person_ids: body.personIds ?? [],
      project_ids: body.projectIds ?? [],
      milestone_ids: body.milestoneIds ?? [],
      parent_task_ids: body.parentTaskIds ?? [],
      sub_task_ids: body.subTaskIds ?? [],
      blocking_ids: body.blockingIds ?? [],
      blocked_by_ids: body.blockedByIds ?? [],
      timesheet_ids: [],
      meeting_ids: [],
      due_date: body.dueDate?.start ?? null,
      estimate_hours: body.estimateHours ?? null,
      archive: false,
    });

    return json({
      id,
      task: body.task,
      status: body.status ?? "in queue",
      taskType: body.taskType ?? null,
      priority: body.priority ?? null,
      ownerIds: body.ownerIds ?? [],
      personIds: body.personIds ?? [],
      projectIds: body.projectIds ?? [],
      milestoneIds: body.milestoneIds ?? [],
      parentTaskIds: body.parentTaskIds ?? [],
      subTaskIds: body.subTaskIds ?? [],
      blockingIds: body.blockingIds ?? [],
      blockedByIds: body.blockedByIds ?? [],
      timesheetIds: [],
      meetingIds: [],
      dueDate: body.dueDate ?? null,
      estimateHours: body.estimateHours ?? null,
      archive: false,
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/work-items] POST failed:", err);
    return error("failed to create work item", 500);
  }
}
