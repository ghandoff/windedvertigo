/**
 * Phase A3: GET reads Supabase, POST writes to Supabase directly.
 */
import { NextRequest } from "next/server";
import {
  getCampaignStepsFromSupabase,
  upsertCampaignStepToSupabase,
} from "@/lib/supabase/campaign-steps";
import { json, error } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  try {
    const steps = await getCampaignStepsFromSupabase(id);
    return json({ data: steps });
  } catch (err) {
    console.error("[api/campaigns/[id]/steps] GET failed:", err);
    return error("failed to load campaign steps", 500);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body) return error("request body is required");

  try {
    // Auto-compute step number based on existing steps
    const existingSteps = await getCampaignStepsFromSupabase(id);
    const stepNumber = existingSteps.length + 1;
    const channel = body.channel ?? "email";
    const name = body.name ?? `step ${stepNumber} — ${channel}`;
    const stepId = crypto.randomUUID();

    await upsertCampaignStepToSupabase(stepId, {
      name,
      campaign_ids: [id],
      step_number: stepNumber,
      channel,
      subject: body.subject ?? null,
      body: body.body ?? null,
      delay_days: body.delayDays ?? null,
      send_date: body.sendDate?.start ?? null,
      status: body.status ?? "draft",
      sent_count: null,
      skipped_count: null,
      failed_count: null,
    });

    return json({
      id: stepId,
      name,
      campaignIds: [id],
      stepNumber,
      channel,
      subject: body.subject ?? "",
      body: body.body ?? "",
      delayDays: body.delayDays ?? null,
      sendDate: body.sendDate ?? null,
      status: body.status ?? "draft",
      variantBSubject: "",
      variantBBody: "",
      condition: "",
      sentCount: null,
      skippedCount: null,
      failedCount: null,
      createdTime: new Date().toISOString(),
      lastEditedTime: new Date().toISOString(),
    }, 201);
  } catch (err) {
    console.error("[api/campaigns/[id]/steps] POST failed:", err);
    return error("failed to create campaign step", 500);
  }
}
