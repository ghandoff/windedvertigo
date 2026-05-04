/**
 * Phase A3: GET, PATCH, DELETE use Supabase directly.
 */
import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getCampaignStepByIdFromSupabase,
  upsertCampaignStepToSupabase,
  deleteCampaignStepFromSupabase,
} from "@/lib/supabase/campaign-steps";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const step = await getCampaignStepByIdFromSupabase(id);
    if (!step) return error("Campaign step not found", 404);
    return json(step);
  } catch (err) {
    console.error("[api/campaign-steps/[id]] GET failed:", err);
    return error("failed to load campaign step", 500);
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
    if (body.campaignIds !== undefined) patch.campaign_ids = body.campaignIds;
    if (body.stepNumber !== undefined) patch.step_number = body.stepNumber;
    if (body.channel !== undefined) patch.channel = body.channel;
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.body !== undefined) patch.body = body.body;
    if (body.delayDays !== undefined) patch.delay_days = body.delayDays;
    if (body.sendDate !== undefined) patch.send_date = body.sendDate?.start ?? null;
    if (body.status !== undefined) patch.status = body.status;
    if (body.sentCount !== undefined) patch.sent_count = body.sentCount;
    if (body.skippedCount !== undefined) patch.skipped_count = body.skippedCount;
    if (body.failedCount !== undefined) patch.failed_count = body.failedCount;

    await upsertCampaignStepToSupabase(id, patch);

    const updated = await getCampaignStepByIdFromSupabase(id);
    // Purge ISR cache for the campaign page so status changes are immediately visible
    for (const campaignId of updated?.campaignIds ?? []) {
      revalidatePath(`/campaigns/${campaignId}`);
    }
    return json(updated);
  } catch (err) {
    console.error("[api/campaign-steps/[id]] PATCH failed:", err);
    return error("failed to update campaign step", 500);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    await deleteCampaignStepFromSupabase(id);
    return json({ archived: true });
  } catch (err) {
    console.error("[api/campaign-steps/[id]] DELETE failed:", err);
    return error("failed to delete campaign step", 500);
  }
}
