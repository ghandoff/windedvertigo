/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getMilestoneByIdFromSupabase,
  upsertMilestoneToSupabase,
  deleteMilestoneFromSupabase,
} from "@/lib/supabase/milestones";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const ms = await getMilestoneByIdFromSupabase(id);
    if (!ms) return error("Milestone not found", 404);
    return json(ms);
  } catch (err) {
    console.error("[api/milestones/[id]] GET failed:", err);
    return error("failed to load milestone", 500);
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
    if (body.milestone !== undefined) patch.milestone = body.milestone;
    if (body.kind !== undefined) patch.kind = body.kind;
    if (body.milestoneStatus !== undefined) patch.milestone_status = body.milestoneStatus;
    if (body.projectIds !== undefined) patch.project_ids = body.projectIds;
    if (body.taskIds !== undefined) patch.task_ids = body.taskIds;
    if (body.ownerIds !== undefined) patch.owner_ids = body.ownerIds;
    if (body.startDate !== undefined) patch.start_date = body.startDate ?? null;
    if (body.endDate !== undefined) patch.end_date = body.endDate ?? null;
    if (body.clientVisible !== undefined) patch.client_visible = body.clientVisible;
    if (body.description !== undefined) patch.description = body.description;
    if (body.brief !== undefined) patch.brief = body.brief;
    if (body.billingTotal !== undefined) patch.billing_total = body.billingTotal;
    if (body.archive !== undefined) patch.archive = body.archive;

    await upsertMilestoneToSupabase(id, patch);

    const updated = await getMilestoneByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/milestones/[id]] PATCH failed:", err);
    return error("failed to update milestone", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteMilestoneFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/milestones/[id]] DELETE failed:", err);
    return error("failed to delete milestone", 500);
  }
}
