/**
 * POST /api/campaigns/[id]/send-step
 *
 * Batch send a campaign step to all orgs in the audience.
 * Body: { stepId: string, senderName?: string }
 */

import { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { getCampaign } from "@/lib/notion/campaigns";
import { getCampaignStep, updateCampaignStep, getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import { getContact } from "@/lib/notion/contacts";
import { batchSendEmails, batchCreateSocialDrafts, filterByCondition, type StepCondition } from "@/lib/campaign/batch-send";
import { json, error } from "@/lib/api-helpers";
import type { Contact } from "@/lib/notion/types";

// 7 contacts × 250 ms pacing = ~1.75s; 100 contacts = ~25s; 1,200 contacts = ~300s.
export const maxDuration = 300;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body?.stepId) return error("stepId is required");

  try {
    // 1. validate campaign + step
    const campaign = await getCampaign(id);
    const step = await getCampaignStep(body.stepId);

    if (!step.campaignIds.includes(id)) {
      return error("step does not belong to this campaign", 400);
    }
    if (step.status === "sent" || step.status === "sending") {
      return error(`step is already ${step.status}`, 400);
    }
    const isSocial = step.channel === "linkedin" || step.channel === "twitter" || step.channel === "bluesky";
    if (!isSocial && !step.subject) {
      return error("email steps must have a subject", 400);
    }
    if (!step.body) {
      return error("step must have a body", 400);
    }

    // 2. resolve audience
    let orgs = await resolveAudience(campaign.audienceFilters);

    // Resolve directly-added contacts and removed-contact IDs from the filter blob
    const { addedContactIds = [], removedContactIds = [] } = campaign.audienceFilters ?? {};
    let additionalContacts: Contact[] = [];
    if (addedContactIds.length > 0) {
      const fetched = await Promise.all(addedContactIds.map((cid: string) => getContact(cid).catch(() => null)));
      additionalContacts = fetched.filter(Boolean) as Contact[];
    }

    if (orgs.length === 0 && additionalContacts.length === 0) {
      return error("no organizations or contacts match the campaign audience filters", 400);
    }

    // 2b. apply conditional branching if step has a condition
    if (step.condition) {
      try {
        const condition: StepCondition = JSON.parse(step.condition);
        const allSteps = await getStepsForCampaign(id);
        const prevStep = allSteps.find(
          (s) => (s.stepNumber ?? 0) === (step.stepNumber ?? 0) - 1 && s.status === "sent",
        );
        if (prevStep && condition.previousStep) {
          // Pass prevStep.id so filterByCondition queries actual sent drafts, not a proxy list
          orgs = await filterByCondition(orgs, condition, prevStep.id);
        }
      } catch {
        // ignore invalid condition JSON
      }
    }

    // 3. mark step as sending
    await updateCampaignStep(body.stepId, { status: "sending" });

    // 4. send — branch on channel type
    let result;
    if (isSocial) {
      // social channels: create drafts in the social queue
      const socialResult = await batchCreateSocialDrafts({
        body: step.body,
        platform: step.channel as "linkedin" | "twitter" | "bluesky",
        orgs,
        senderName: body.senderName,
      });
      result = { sent: socialResult.created, skipped: socialResult.skipped, failed: socialResult.failed };
    } else {
      // email channel: send via Resend (with A/B variant support)
      result = await batchSendEmails({
        subject: step.subject,
        body: step.body,
        senderName: body.senderName,
        orgs,
        campaignName: campaign.name,
        campaignId: id,
        stepId: body.stepId,
        variantBSubject: step.variantBSubject || undefined,
        variantBBody: step.variantBBody || undefined,
        removedContactIds,
        additionalContacts,
      });
    }

    // 5. mark step as sent and persist cumulative send counts
    await updateCampaignStep(body.stepId, {
      status: "sent",
      sendDate: { start: new Date().toISOString().split("T")[0], end: null },
      sentCount: (step.sentCount ?? 0) + result.sent,
      skippedCount: (step.skippedCount ?? 0) + result.skipped,
      failedCount: (step.failedCount ?? 0) + result.failed,
    });

    // Purge ISR cache so any visitor sees the updated step status immediately
    revalidatePath(`/campaigns/${id}`);

    return json({
      ...result,
      channel: step.channel,
      audienceSize: orgs.length,
      stepId: body.stepId,
      campaignId: id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "batch send failed";
    console.error("[campaigns/send-step]", msg);

    // try to revert step status on failure
    try {
      await updateCampaignStep(body.stepId, { status: "draft" });
    } catch {
      // ignore revert failure
    }

    return error(msg, 500);
  }
}
