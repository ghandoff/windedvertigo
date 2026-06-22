/**
 * GET /api/cron/rfp-deal-reconcile
 *
 * Nightly safety net keeping `deals` consistent with the RFP Lighthouse:
 *   - every "won" RFP must be a signed, linked deal — self-heals via
 *     syncWonRfpToDeal (idempotent) for any that slipped past the
 *     transitionRfpStatus hook (e.g. status changed outside that path).
 *   - flags drift it should NOT auto-resolve: a linked deal whose
 *     contracted_amount diverges from the RFP estimate, and rfp-origin deals
 *     left unlinked (rfp_ids empty).
 *
 * Reports a digest to Slack. Does not touch active/lost RFPs — only "won".
 * Auth: Bearer CRON_SECRET (standard CF-worker cron pattern).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { syncWonRfpToDeal } from "@/lib/rfp/deal-sync";
import { getDealByRfpId } from "@/lib/supabase/deals";
import { postToChannel } from "@/lib/slack";

export const maxDuration = 60;

const CHANNEL = process.env.SLACK_RFP_CHANNEL ?? "#funding-opportunities";

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!auth && auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const healed: string[] = [];
  const drift: string[] = [];

  try {
    const { data: wonRfps } = await supabase
      .from("rfp_opportunities")
      .select("notion_page_id, opportunity_name, estimated_value, organization_ids")
      .eq("status", "won");

    for (const r of wonRfps ?? []) {
      const rfp = {
        opportunityName: r.opportunity_name as string,
        estimatedValue: r.estimated_value != null ? Number(r.estimated_value) : null,
        organizationIds: (r.organization_ids as string[]) ?? [],
      };
      const linked = await getDealByRfpId(r.notion_page_id);
      const consistent = !!linked && linked.revenueTier === "signed" && linked.stage === "won";
      if (!consistent) {
        const res = await syncWonRfpToDeal(r.notion_page_id, rfp, "reconcile-cron");
        healed.push(`${rfp.opportunityName} (${res.action})`);
      }
      const after = linked ?? (await getDealByRfpId(r.notion_page_id));
      if (
        after &&
        rfp.estimatedValue != null &&
        after.contractedAmount != null &&
        Math.abs(after.contractedAmount - rfp.estimatedValue) > 1
      ) {
        drift.push(`${rfp.opportunityName}: deal $${after.contractedAmount} vs RFP est $${rfp.estimatedValue}`);
      }
    }

    const { data: rfpDeals } = await supabase
      .from("deals")
      .select("deal, rfp_ids, origin_type")
      .eq("origin_type", "rfp");
    const orphans = (rfpDeals ?? []).filter((d) => !((d.rfp_ids as string[]) ?? []).length).map((d) => d.deal as string);

    const lines: string[] = [];
    if (healed.length) lines.push(`*healed (${healed.length}):* ${healed.join(", ")}`);
    if (drift.length) lines.push(`*value drift (${drift.length}):* ${drift.join("; ")}`);
    if (orphans.length) lines.push(`*orphan rfp-deals (unlinked):* ${orphans.join(", ")}`);
    if (lines.length) {
      postToChannel(CHANNEL, `:link: rfp↔deal reconcile —\n${lines.join("\n")}`).catch(() => {});
    }

    console.log("[rfp-deal-reconcile]", { healed: healed.length, drift: drift.length, orphans: orphans.length });
    return NextResponse.json({ ok: true, healed, drift, orphans });
  } catch (err) {
    console.error("[rfp-deal-reconcile] failed:", err);
    return NextResponse.json({ error: "reconcile failed" }, { status: 500 });
  }
}
