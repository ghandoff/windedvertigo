/**
 * GET /api/campaigns/[id]/recipients
 *
 * Returns every email draft for a campaign, enriched with the recipient org's
 * current name, relationship, and fit rating. Designed for the recipient log
 * page and for programmatic audits.
 *
 * Response shape:
 * {
 *   campaign: { id, name, status },
 *   recipients: [{ orgId, orgName, relationship, fitRating, status, sentAt, opens, clicks, machineOpens }],
 *   summary: { total, sent, failed, opened, humanOpened, machineOnly, noOpens, clicked }
 * }
 */

import { NextRequest } from "next/server";
import { getCampaign } from "@/lib/notion/campaigns";
import { queryEmailDraftsByCampaign } from "@/lib/notion/email-drafts";
import { getOrganization } from "@/lib/notion/organizations";
import { json, withNotionError } from "@/lib/api-helpers";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  return withNotionError(async () => {
    const campaign = await getCampaign(id);
    const drafts = await queryEmailDraftsByCampaign(id);

    // Collect unique org IDs and batch-fetch their details
    const uniqueOrgIds = [...new Set(drafts.map((d) => d.organizationId).filter(Boolean))];
    const orgMap = new Map<string, { name: string; relationship: string; fitRating: string }>();

    // Fetch in batches of 10 to respect rate limits
    for (let i = 0; i < uniqueOrgIds.length; i += 10) {
      const batch = uniqueOrgIds.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (orgId) => {
          try {
            const org = await getOrganization(orgId);
            return { id: orgId, name: org.organization, relationship: org.relationship, fitRating: org.fitRating };
          } catch {
            return { id: orgId, name: "[unknown]", relationship: "", fitRating: "" };
          }
        }),
      );
      for (const r of results) {
        orgMap.set(r.id, { name: r.name, relationship: r.relationship, fitRating: r.fitRating });
      }
    }

    const recipients = drafts.map((d) => {
      const org = orgMap.get(d.organizationId);
      return {
        draftId: d.id,
        orgId: d.organizationId,
        orgName: org?.name ?? "[unknown]",
        relationship: org?.relationship ?? "",
        fitRating: org?.fitRating ?? "",
        status: d.status,
        sentAt: d.sentAt,
        opens: d.opens,
        clicks: d.clicks,
        machineOpens: d.machineOpens,
      };
    });

    const sent = recipients.filter((r) => r.status === "sent");

    return json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
      },
      recipients,
      summary: {
        total: recipients.length,
        sent: sent.length,
        failed: recipients.filter((r) => r.status === "failed").length,
        opened: sent.filter((r) => r.opens > 0).length,
        humanOpened: sent.filter((r) => r.opens > 0).length,
        machineOnly: sent.filter((r) => r.opens === 0 && r.machineOpens > 0).length,
        noOpens: sent.filter((r) => r.opens === 0 && r.machineOpens === 0).length,
        clicked: sent.filter((r) => r.clicks > 0).length,
      },
    });
  });
}
