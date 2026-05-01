import { NextRequest } from "next/server";
import { getCampaign } from "@/lib/notion/campaigns";
import { previewAudience, resolveAudience } from "@/lib/notion/audience";
import { json, error, withNotionError, boolParam } from "@/lib/api-helpers";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const preview = boolParam(req, "preview");

  return withNotionError(async () => {
    const campaign = await getCampaign(id);
    if (!campaign.audienceFilters || Object.keys(campaign.audienceFilters).length === 0) {
      return { count: 0, organizations: [] };
    }

    if (preview) {
      const result = await previewAudience(campaign.audienceFilters, 10);
      return { count: result.count, organizations: result.preview };
    }

    const orgs = await resolveAudience(campaign.audienceFilters);
    return { count: orgs.length, organizations: orgs };
  });
}
