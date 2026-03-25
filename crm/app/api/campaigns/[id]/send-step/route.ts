/**
 * POST /api/campaigns/[id]/send-step
 *
 * Batch send a campaign step to all orgs in the audience.
 * Body: { stepId: string, senderName?: string }
 */

import { NextRequest } from "next/server";
import { getCampaign } from "@/lib/notion/campaigns";
import { getCampaignStep, updateCampaignStep, getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import { batchSendEmails, filterByCondition, type StepCondition } from "@/lib/campaign/batch-send";
import { json, error } from "@/lib/api-helpers";

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
    if (step.channel !== "email") {
      return error("only email steps can be sent via this endpoint (social steps coming in phase 2)", 400);
    }
    if (!step.subject || !step.body) {
      return error("step must have a subject and body", 400);
    }

    // 2. resolve audience
    let orgs = await resolveAudience(campaign.audienceFilters);
    if (orgs.length === 0) {
      return error("no organizations match the campaign audience filters", 400);
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
          const prevOrgIds = orgs.map((o) => o.id);
          orgs = await filterByCondition(orgs, condition, prevOrgIds);
        }
      } catch {
        // ignore invalid condition JSON
      }
    }

    // 3. mark step as sending
    await updateCampaignStep(body.stepId, { status: "sending" });

    // 4. batch send (with A/B variant support)
    const result = await batchSendEmails({
      subject: step.subject,
      body: step.body,
      senderName: body.senderName,
      orgs,
      variantBSubject: step.variantBSubject || undefined,
      variantBBody: step.variantBBody || undefined,
    });

    // 5. mark step as sent
    await updateCampaignStep(body.stepId, {
      status: "sent",
      sendDate: { start: new Date().toISOString().split("T")[0], end: null },
    });

    return json({
      ...result,
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
