import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { auth } from "@/lib/auth";
import {
  getMilestonesByRfp,
  insertMilestones,
  setMilestoneStatus,
  type MilestoneStatus,
} from "@/lib/supabase/rfp-milestones";
import { supabase } from "@/lib/supabase/client";

const VALID_STATUSES = new Set<MilestoneStatus>([
  "pending",
  "in-progress",
  "done",
  "slipped",
  "cancelled",
]);

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const { id } = await params;
  const milestones = await getMilestonesByRfp(id);
  return json(milestones);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body?.label?.trim()) return error("label is required");
  if (!body?.dueAt) return error("dueAt is required");

  const [milestone] = await insertMilestones([
    {
      rfpId: id,
      label: body.label.trim(),
      dueAt: body.dueAt,
      ownerEmail: body.ownerEmail ?? null,
    },
  ]);
  return json(milestone, 201);
}

export async function PATCH(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.milestoneId) return error("milestoneId is required");

  // Status update
  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return error("invalid status");
    }
    await setMilestoneStatus(body.milestoneId, body.status as MilestoneStatus);
  }

  // Allow updating due_at and/or label in-place
  if (body.dueAt !== undefined || body.label !== undefined) {
    const patch: Record<string, unknown> = {};
    if (body.dueAt !== undefined) patch.due_at = body.dueAt;
    if (body.label !== undefined) patch.label = body.label;
    const { error: sbErr } = await supabase
      .from("rfp_milestones")
      .update(patch)
      .eq("id", body.milestoneId);
    if (sbErr) return error(sbErr.message, 500);
  }

  return json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  _ctx: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.milestoneId) return error("milestoneId is required");

  const { error: sbErr } = await supabase
    .from("rfp_milestones")
    .delete()
    .eq("id", body.milestoneId);
  if (sbErr) return error(sbErr.message, 500);

  return json({ ok: true });
}
