/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getActivityByIdFromSupabase,
  upsertActivityToSupabase,
  deleteActivityFromSupabase,
} from "@/lib/supabase/activities";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const activity = await getActivityByIdFromSupabase(id);
    if (!activity) return error("Activity not found", 404);
    return json(activity);
  } catch (err) {
    console.error("[api/activities/[id]] GET failed:", err);
    return error("failed to load activity", 500);
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
    if (body.activity !== undefined) patch.activity = body.activity;
    if (body.type !== undefined) patch.type = body.type;
    if (body.date !== undefined) patch.date = body.date?.start ?? null;
    if (body.outcome !== undefined) patch.outcome = body.outcome;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.loggedBy !== undefined) patch.logged_by = body.loggedBy;
    if (body.organizationIds !== undefined) patch.organization_ids = body.organizationIds;
    if (body.contactIds !== undefined) patch.contact_ids = body.contactIds;

    await upsertActivityToSupabase(id, patch);

    const updated = await getActivityByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/activities/[id]] PATCH failed:", err);
    return error("failed to update activity", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteActivityFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/activities/[id]] DELETE failed:", err);
    return error("failed to delete activity", 500);
  }
}
