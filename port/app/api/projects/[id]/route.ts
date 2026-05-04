/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getProjectByIdFromSupabase,
  upsertProjectToSupabase,
  deleteProjectFromSupabase,
} from "@/lib/supabase/projects";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const proj = await getProjectByIdFromSupabase(id);
    if (!proj) return error("Project not found", 404);
    return json(proj);
  } catch (err) {
    console.error("[api/projects/[id]] GET failed:", err);
    return error("failed to load project", 500);
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
    if (body.project !== undefined) patch.project = body.project;
    if (body.status !== undefined) patch.status = body.status;
    if (body.priority !== undefined) patch.priority = body.priority;
    if (body.type !== undefined) patch.type = body.type;
    if (body.budgetHours !== undefined) patch.budget_hours = body.budgetHours;
    if (body.eventType !== undefined) patch.event_type = body.eventType;
    if (body.timeline !== undefined) {
      patch.timeline_start = body.timeline?.start ?? null;
      patch.timeline_end = body.timeline?.end ?? null;
    }
    if (body.projectLeadIds !== undefined) patch.project_lead_ids = body.projectLeadIds;
    if (body.organizationIds !== undefined) patch.organization_ids = body.organizationIds;
    if (body.milestoneIds !== undefined) patch.milestone_ids = body.milestoneIds;
    if (body.taskIds !== undefined) patch.task_ids = body.taskIds;
    if (body.cycleIds !== undefined) patch.cycle_ids = body.cycleIds;
    if (body.archive !== undefined) patch.archive = body.archive;

    await upsertProjectToSupabase(id, patch);

    const updated = await getProjectByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/projects/[id]] PATCH failed:", err);
    return error("failed to update project", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteProjectFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/projects/[id]] DELETE failed:", err);
    return error("failed to delete project", 500);
  }
}
