/**
 * GET /api/cron/biz-value-proposer
 *
 * Daily. Biz's first spine-integrated behavior + the data unlock for its
 * charter "Number" (weighted pipeline coverage). Active RFPs (radar/pursuing)
 * have `estimated_value` null on ~all of them — it's a manual Notion field the
 * ingest never fills — so Biz can't compute a weighted-pipeline number.
 *
 * For each active RFP missing a value (that has a one-pager to read and isn't
 * already proposed), Claude proposes an estimated value (lib/biz/value-extract)
 * and this surfaces it as a MEDIUM-tier preview card to Garrett. On approve,
 * the intervention executor (`biz_set_estimated_value`) writes it to NOTION —
 * the source of truth — and the hourly Notion→Supabase sync flows it back.
 *
 * Budget-gated (≤3/agent/day, ≤5/human/day): the 39-item backfill paces itself
 * over ~2 weeks instead of flooding, and new RFPs get a proposal as they land.
 * Dedup by RFP notion_page_id against recent Biz interventions so a given RFP
 * is proposed at most once per 7-day window.
 */

import { NextRequest, NextResponse } from "next/server";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { insertIntervention, listRecentByAgent } from "@/lib/supabase/agent-interventions";
import { NotificationBudget } from "@/lib/agent/intervention-budget";
import { proposeEstimatedValue } from "@/lib/biz/value-extract";
import { buildInterventionBlocks, interventionFallbackText } from "@/lib/agent/intervention-card";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const MAX_EXTRACT_PER_RUN = 6; // cap the AI calls per run (cost + latency)
const ACTIVE = new Set(["radar", "pursuing"]);
const GARRETT_EMAIL = "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

function alreadyProposedIds(
  recent: Awaited<ReturnType<typeof listRecentByAgent>>,
): Set<string> {
  const ids = new Set<string>();
  for (const row of recent) {
    const action = row.artifact?.executeAction as { type?: string; notionPageId?: string } | undefined;
    if (action?.type === "biz_set_estimated_value" && action.notionPageId) {
      ids.add(action.notionPageId);
    }
  }
  return ids;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [{ data: rfps }, recentBiz] = await Promise.all([
    getRfpOpportunitiesFromSupabase({}, { pageSize: 500 }),
    listRecentByAgent("biz", 7),
  ]);
  const handled = alreadyProposedIds(recentBiz);

  const candidates = rfps
    .filter(
      (r) =>
        ACTIVE.has(r.status) &&
        r.estimatedValue == null &&
        r.onePager != null &&
        !handled.has(r.id),
    )
    .slice(0, MAX_EXTRACT_PER_RUN);

  const budget = await NotificationBudget.load("biz");
  const dmsAllowed = ambientDirectDmsAllowed();
  let proposed = 0;
  let suppressedByBudget = 0;
  let skippedNoBasis = 0;

  for (const rfp of candidates) {
    const proposal = await proposeEstimatedValue(rfp.opportunityName, rfp.onePager);
    if (!proposal || proposal.value == null) {
      skippedNoBasis += 1;
      continue;
    }

    const overBudget = await budget.wouldExceed(GARRETT_EMAIL);
    const valueStr = `$${proposal.value.toLocaleString("en-US")}`;
    const body =
      `propose estimated value **${valueStr}** for *${rfp.opportunityName}* (${proposal.confidence} confidence)\n\n` +
      `${proposal.basis}\n\napprove to write it to Notion (the pipeline number needs it).`;

    const row = await insertIntervention({
      agent: "biz",
      decision: "preview",
      riskTier: "medium",
      trigger: `RFP "${rfp.opportunityName}" has no estimated value — proposing one so the weighted-pipeline number works`,
      artifact: {
        title: `estimated value — ${rfp.opportunityName}`,
        body,
        executeAction: { type: "biz_set_estimated_value", notionPageId: rfp.id, value: proposal.value },
      },
      rationale: "charter: weighted pipeline coverage — RFPs need an estimated value to count",
      channel: `dm:${GARRETT_EMAIL}`,
      targetHuman: GARRETT_EMAIL,
    });
    if (!row) continue;
    budget.record(GARRETT_EMAIL);

    if (overBudget) {
      suppressedByBudget += 1;
      continue; // inserted, left `proposed` in /inbox — no ping
    }

    const blocks = buildInterventionBlocks(row);
    const text = interventionFallbackText(row);
    if (dmsAllowed) {
      await sendDmByEmail(GARRETT_EMAIL, text, blocks);
    } else {
      await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${GARRETT_EMAIL}]\n${text}`, [], blocks);
    }
    proposed += 1;
  }

  return NextResponse.json({
    candidates: candidates.length,
    proposed,
    suppressedByBudget,
    skippedNoBasis,
  });
}
