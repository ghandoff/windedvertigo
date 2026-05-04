/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getCycleByIdFromSupabase,
  upsertCycleToSupabase,
  deleteCycleFromSupabase,
} from "@/lib/supabase/cycles";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const cycle = await getCycleByIdFromSupabase(id);
    if (!cycle) return error("Cycle not found", 404);
    return json(cycle);
  } catch (err) {
    console.error("[api/cycles/[id]] GET failed:", err);
    return error("failed to load cycle", 500);
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
    if (body.cycle !== undefined) patch.cycle = body.cycle;
    if (body.startDate !== undefined) patch.start_date = body.startDate?.start ?? null;
    if (body.endDate !== undefined) patch.end_date = body.endDate?.start ?? null;
    if (body.projectIds !== undefined) patch.project_ids = body.projectIds;
    if (body.status !== undefined) patch.status = body.status;
    if (body.goal !== undefined) patch.goal = body.goal;
    patch.updated_at = new Date().toISOString();

    await upsertCycleToSupabase(id, patch);

    const updated = await getCycleByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/cycles/[id]] PATCH failed:", err);
    return error("failed to update cycle", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteCycleFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/cycles/[id]] DELETE failed:", err);
    return error("failed to delete cycle", 500);
  }
}
