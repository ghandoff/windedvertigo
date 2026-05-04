/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getCampaignByIdFromSupabase,
  upsertCampaignToSupabase,
  deleteCampaignFromSupabase,
} from "@/lib/supabase/campaigns";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const campaign = await getCampaignByIdFromSupabase(id);
    if (!campaign) return error("Campaign not found", 404);
    return json(campaign);
  } catch (err) {
    console.error("[api/campaigns/[id]] GET failed:", err);
    return error("failed to load campaign", 500);
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
    if (body.name !== undefined) patch.name = body.name;
    if (body.type !== undefined) patch.type = body.type;
    if (body.status !== undefined) patch.status = body.status;
    if (body.eventIds !== undefined) patch.event_ids = body.eventIds;
    if (body.audienceFilters !== undefined) patch.audience_filters = body.audienceFilters;
    if (body.owner !== undefined) patch.owner = body.owner;
    if (body.startDate !== undefined) patch.start_date = body.startDate?.start ?? null;
    if (body.endDate !== undefined) patch.end_date = body.endDate?.start ?? null;
    if (body.notes !== undefined) patch.notes = body.notes;

    await upsertCampaignToSupabase(id, patch);

    const updated = await getCampaignByIdFromSupabase(id);
    return json(updated);
  } catch (err) {
    console.error("[api/campaigns/[id]] PATCH failed:", err);
    return error("failed to update campaign", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteCampaignFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/campaigns/[id]] DELETE failed:", err);
    return error("failed to delete campaign", 500);
  }
}
