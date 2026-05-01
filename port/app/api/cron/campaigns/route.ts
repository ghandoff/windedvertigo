/**
 * GET /api/cron/campaigns
 *
 * Vercel cron job — runs daily at 9:07am.
 * Processes active campaigns: finds steps that are due and sends them.
 *
 * A step is "due" when:
 *   - It has a sendDate and that date is today or earlier
 *   - OR it has delayDays and the computed date (campaign start + cumulative delays) is today or earlier
 *   - AND the step status is "scheduled" or "draft"
 *   - AND the step channel is "email" (social channels create drafts instead)
 */

import { NextRequest, NextResponse } from "next/server";
import { queryCampaigns } from "@/lib/notion/campaigns";
import { getStepsForCampaign, updateCampaignStep } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import { queryActivities } from "@/lib/notion/activities";
import { batchSendEmails } from "@/lib/campaign/batch-send";
import { createSocialDraft } from "@/lib/notion/social";
import { resolveTemplateVars } from "@/lib/campaign/template-vars";
import type { CampaignStep, Campaign } from "@/lib/notion/types";

/**
 * Get the set of org IDs that have replied to any of our emails.
 * These orgs should not receive further campaign steps (sequence auto-pause).
 */
async function getRepliedOrgIds(campaignStartDate: string | null): Promise<Set<string>> {
  const { data: replyActivities } = await queryActivities(
    { type: "email received" },
    { pageSize: 500 },
  );

  const repliedIds = new Set<string>();
  for (const activity of replyActivities) {
    // Only count replies after campaign start (earlier replies don't count)
    if (campaignStartDate && activity.date?.start) {
      if (activity.date.start < campaignStartDate) continue;
    }
    for (const orgId of activity.organizationIds) {
      repliedIds.add(orgId);
    }
  }
  return repliedIds;
}

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  return token === process.env.CRON_SECRET;
}

function isStepDue(
  step: CampaignStep,
  campaign: Campaign,
  previousSteps: CampaignStep[],
): boolean {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Absolute send date takes precedence
  if (step.sendDate?.start) {
    const sendDate = new Date(step.sendDate.start);
    sendDate.setHours(0, 0, 0, 0);
    return sendDate <= today;
  }

  // Compute from campaign start + cumulative delays
  if (!campaign.startDate?.start) return false;

  const campaignStart = new Date(campaign.startDate.start);
  campaignStart.setHours(0, 0, 0, 0);

  const cumulativeDelay = previousSteps
    .filter((s) => (s.stepNumber ?? 0) < (step.stepNumber ?? 0))
    .reduce((sum, s) => sum + (s.delayDays ?? 0), 0);

  const dueDate = new Date(campaignStart);
  dueDate.setDate(dueDate.getDate() + cumulativeDelay + (step.delayDays ?? 0));

  return dueDate <= today;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const actions: string[] = [];

  try {
    // Get all active campaigns
    const { data: campaigns } = await queryCampaigns(
      { status: "active" },
      { pageSize: 50 },
    );

    if (campaigns.length === 0) {
      return NextResponse.json({ message: "no active campaigns", actions });
    }

    for (const campaign of campaigns) {
      const steps = await getStepsForCampaign(campaign.id);
      const hasFilters = campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0;

      if (!hasFilters) continue;

      for (const step of steps) {
        // Only process draft or scheduled steps
        if (step.status !== "draft" && step.status !== "scheduled") continue;

        // Check if step is due
        if (!isStepDue(step, campaign, steps)) continue;

        // Process based on channel
        if (step.channel === "email") {
          // Batch send email
          if (!step.subject || !step.body) {
            actions.push(`skipped ${campaign.name} / ${step.name}: missing subject or body`);
            continue;
          }

          const allOrgs = await resolveAudience(campaign.audienceFilters);
          if (allOrgs.length === 0) {
            actions.push(`skipped ${campaign.name} / ${step.name}: no matching orgs`);
            continue;
          }

          // Auto-pause: skip orgs that already replied to a previous step
          const repliedOrgIds = await getRepliedOrgIds(campaign.startDate?.start ?? null);
          const orgs = allOrgs.filter((o) => !repliedOrgIds.has(o.id));
          const pausedCount = allOrgs.length - orgs.length;
          if (pausedCount > 0) {
            actions.push(`auto-paused ${pausedCount} orgs that replied — ${campaign.name} / ${step.name}`);
          }
          if (orgs.length === 0) {
            actions.push(`skipped ${campaign.name} / ${step.name}: all orgs replied`);
            await updateCampaignStep(step.id, { status: "skipped" });
            continue;
          }

          await updateCampaignStep(step.id, { status: "sending" });

          const result = await batchSendEmails({
            subject: step.subject,
            body: step.body,
            orgs,
            campaignName: campaign.name,
          });

          await updateCampaignStep(step.id, {
            status: "sent",
            sendDate: { start: new Date().toISOString().split("T")[0], end: null },
          });

          actions.push(
            `sent ${campaign.name} / ${step.name}: ${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed`,
          );
        } else {
          // Social channel — create drafts
          const orgs = await resolveAudience(campaign.audienceFilters);

          for (const org of orgs.slice(0, 5)) {
            // Create social draft with resolved variables
            const resolvedContent = resolveTemplateVars(step.body, {
              orgName: org.organization,
              orgEmail: org.email,
              orgWebsite: org.website,
            });

            await createSocialDraft({
              content: resolvedContent,
              platform: step.channel as "linkedin" | "twitter" | "bluesky",
              status: "draft",
              organizationId: org.id,
              notes: `from campaign: ${campaign.name}`,
            });
          }

          await updateCampaignStep(step.id, {
            status: "sent",
            sendDate: { start: new Date().toISOString().split("T")[0], end: null },
          });

          actions.push(
            `created ${Math.min(orgs.length, 5)} social drafts for ${campaign.name} / ${step.name}`,
          );
        }
      }

      // Check if all steps are sent — if so, mark campaign as complete
      const updatedSteps = await getStepsForCampaign(campaign.id);
      const allSent = updatedSteps.length > 0 && updatedSteps.every((s) => s.status === "sent" || s.status === "skipped");
      if (allSent) {
        const { updateCampaign } = await import("@/lib/notion/campaigns");
        await updateCampaign(campaign.id, { status: "complete" });
        actions.push(`completed campaign: ${campaign.name}`);
      }
    }

    return NextResponse.json({
      message: `processed ${campaigns.length} active campaigns`,
      actions,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "cron failed";
    console.error("[cron/campaigns]", msg);
    return NextResponse.json({ error: msg, actions }, { status: 500 });
  }
}
