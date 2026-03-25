/**
 * GET /api/campaigns/[id]/analytics
 *
 * Campaign funnel analytics: audience → sent → opened → clicked.
 */

import { NextRequest } from "next/server";
import { getCampaign } from "@/lib/notion/campaigns";
import { getStepsForCampaign } from "@/lib/notion/campaign-steps";
import { resolveAudience } from "@/lib/notion/audience";
import { queryEmailDrafts } from "@/lib/notion/email-drafts";
import { json, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withNotionError(async () => {
    const campaign = await getCampaign(id);
    const steps = await getStepsForCampaign(id);
    const hasFilters = campaign.audienceFilters && Object.keys(campaign.audienceFilters).length > 0;
    const audienceSize = hasFilters
      ? (await resolveAudience(campaign.audienceFilters)).length
      : 0;

    // Get all email drafts (we'll filter by org IDs in the audience)
    const audience = hasFilters ? await resolveAudience(campaign.audienceFilters) : [];
    const audienceOrgIds = new Set(audience.map((o) => o.id));

    const { data: allDrafts } = await queryEmailDrafts(undefined, { pageSize: 100 });
    // Filter to drafts for orgs in this campaign's audience
    const campaignDrafts = allDrafts.filter((d) => audienceOrgIds.has(d.organizationId));

    const totalSent = campaignDrafts.filter((d) => d.status === "sent").length;
    const totalOpened = campaignDrafts.filter((d) => d.opens > 0).length;
    const totalClicked = campaignDrafts.filter((d) => d.clicks > 0).length;

    // Per-step breakdown
    const stepAnalytics = steps.map((step) => ({
      id: step.id,
      name: step.name,
      channel: step.channel,
      status: step.status,
      sendDate: step.sendDate?.start ?? null,
    }));

    return json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
      },
      funnel: {
        audience: audienceSize,
        sent: totalSent,
        opened: totalOpened,
        clicked: totalClicked,
        openRate: totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0,
        clickRate: totalSent > 0 ? Math.round((totalClicked / totalSent) * 100) : 0,
      },
      steps: stepAnalytics,
    });
  });
}
