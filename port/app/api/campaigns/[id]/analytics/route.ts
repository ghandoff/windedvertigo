/**
 * GET /api/campaigns/[id]/analytics
 *
 * Campaign funnel analytics. Funnel stages are counted in UNIQUE ORGS, not
 * in raw draft rows, so percentages are always ≤ 100% regardless of
 * contact fan-out. See lib/campaign/analytics.ts for the full data model.
 */

import { NextRequest } from "next/server";
import { computeCampaignAnalytics } from "@/lib/campaign/analytics";
import { json, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return withNotionError(async () => {
    const analytics = await computeCampaignAnalytics(id);
    return json(analytics);
  });
}
