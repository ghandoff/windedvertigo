/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getWorkItemByIdFromSupabase,
  upsertWorkItemToSupabase,
  deleteWorkItemFromSupabase,
} from "@/lib/supabase/work-items";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const item = await getWorkItemByIdFromSupabase(id);
    if (!item) return error("Work item not found", 404);
    return json(item);
  } catch (err) {
    console.error("[api/work-items/[id]] GET failed:", err);
    return error("failed to load work item", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json();

  try {
    const patch: Record<string, unknown> = {};
    if (body.task !== undefined) patch.task = body.task;
    if (body.status !== undefined) patch.status = body.status;
    if (body.taskType !== undefined) patch.task_type = body.taskType;
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.ownerIds !== undefined) patch.owner_ids = body.ownerIds;
    if (body.personIds !== undefined) patch.person_ids = body.personIds;
    if (body.projectIds !== undefined) patch.project_ids = body.projectIds;
    if (body.milestoneIds !== undefined) patch.milestone_ids = body.milestoneIds;
    if (body.parentTaskIds !== undefined) patch.parent_task_ids = body.parentTaskIds;
    if (body.subTaskIds !== undefined) patch.sub_task_ids = body.subTaskIds;
    if (body.blockingIds !== undefined) patch.blocking_ids = body.blockingIds;
    if (body.blockedByIds !== undefined) patch.blocked_by_ids = body.blockedByIds;
    if (body.dueDate !== undefined) patch.due_date = body.dueDate?.start ?? null;
    if (body.estimateHours !== undefined) patch.estimate_hours = body.estimateHours;
    if (body.archive !== undefined) patch.archive = body.archive;

    await upsertWorkItemToSupabase(id, patch);

    const updated = await getWorkItemByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/work-items/[id]] PATCH failed:", err);
    return error("failed to update work item", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteWorkItemFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/work-items/[id]] DELETE failed:", err);
    return error("failed to delete work item", 500);
  }
}
