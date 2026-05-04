/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getDealByIdFromSupabase,
  upsertDealToSupabase,
  deleteDealFromSupabase,
} from "@/lib/supabase/deals";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const deal = await getDealByIdFromSupabase(id);
    if (!deal) return error("Deal not found", 404);
    return json(deal);
  } catch (err) {
    console.error("[api/deals/[id]] GET failed:", err);
    return error("failed to load deal", 500);
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
    if (body.deal !== undefined) patch.deal = body.deal;
    if (body.stage !== undefined) patch.stage = body.stage;
    if (body.value !== undefined) patch.value = body.value;
    if (body.organizationIds !== undefined) patch.org_ids = body.organizationIds;
    if (body.rfpOpportunityIds !== undefined) patch.rfp_ids = body.rfpOpportunityIds;
    if (body.notes !== undefined) patch.notes = body.notes;
    if (body.lostReason !== undefined) patch.loss_reason = body.lostReason;

    await upsertDealToSupabase(id, patch);

    const updated = await getDealByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/deals/[id]] PATCH failed:", err);
    return error("failed to update deal", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteDealFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/deals/[id]] DELETE failed:", err);
    return error("failed to delete deal", 500);
  }
}
