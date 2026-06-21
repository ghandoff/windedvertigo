/**
 * GET /api/cron/biz-go-no-go-sweep
 *
 * Daily sweep of `radar` cards with no bid_decision that have sat unreviewed
 * for more than 24 hours. Applies a deterministic scoring formula and records
 * a verdict via the same setBidDecision + transitionRfpStatus path that Biz
 * uses in Cowork, so decisions are auditable in biz_decisions and visible on
 * the board immediately.
 *
 * Scoring formula (mirrors the five weighted dimensions in the GONOGO_RECIPE):
 *   low fit                            → no-bid  (score ≈ 20)
 *   medium fit + win_prob < 45         → no-bid  (score ≈ 35)
 *   medium fit + win_prob ≥ 45         → deferred  (score ≈ 52)
 *   TBD fit                            → deferred  (score ≈ 40)
 *   high fit + win_prob ≥ 65           → bid      (score ≈ 80)
 *   high fit + win_prob < 65           → deferred  (score ≈ 60)
 *
 * "deferred" cards are logged but NOT moved — they need a human look before
 * committing. A Slack digest is posted to SLACK_RFP_CHANNEL summarising every
 * decision so the team can override anything surprising.
 *
 * Auth: Bearer CRON_SECRET (standard CF-worker cron pattern).
 * Runs daily at 08:00 UTC, weekdays (registered in lib/scheduled.ts).
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { getGoNoGoInputs, winProbability } from "@/lib/biz-go-no-go";
import { setBidDecision } from "@/lib/supabase/rfp-opportunities";
import { transitionRfpStatus } from "@/lib/rfp/transition";
import { createBizDecision } from "@/lib/biz-data";
import { postToChannel } from "@/lib/slack";

export const maxDuration = 60;

const CHANNEL = process.env.SLACK_RFP_CHANNEL ?? "#funding-opportunities";
const HOLD_HOURS = 24; // only process cards older than this

function verifyCronAuth(req: NextRequest): boolean {
  const auth = req.headers.get("authorization");
  return !!auth && auth.replace("Bearer ", "") === process.env.CRON_SECRET;
}

type Verdict = "bid" | "no-bid" | "deferred";

interface VerdictResult {
  verdict: Verdict;
  score: number;
  reason: string;
}

function score(fit: string, winProb: number): VerdictResult {
  if (fit === "low fit") {
    return { verdict: "no-bid", score: 20, reason: "low fit score from triage — below bid threshold" };
  }
  if (fit === "high fit" && winProb >= 65) {
    return { verdict: "bid", score: 80, reason: `high fit + ${winProb}% win probability — auto-approved for pursuit` };
  }
  if (fit === "high fit") {
    return { verdict: "deferred", score: 60, reason: `high fit but win probability (${winProb}%) below auto-bid threshold — needs human review` };
  }
  if (fit === "medium fit" && winProb >= 45) {
    return { verdict: "deferred", score: 52, reason: `medium fit + ${winProb}% win probability — monitor before committing` };
  }
  if (fit === "medium fit") {
    return { verdict: "no-bid", score: 35, reason: `medium fit but win probability (${winProb}%) too low — not worth pursuing` };
  }
  // TBD or anything else
  return { verdict: "deferred", score: 40, reason: "fit score not yet determined — needs triage before go/no-go" };
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch radar cards with no decision that have aged past the hold window.
  const { data: candidates, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, wv_fit_score, estimated_value, due_date")
    .eq("status", "radar")
    .is("bid_decision", null)
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(30);

  if (queryErr) {
    console.error("[biz-go-no-go-sweep] query failed:", queryErr);
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ swept: 0, message: "no unreviewed radar cards" });
  }

  const results: Array<{
    id: string;
    name: string;
    verdict: Verdict;
    score: number;
    reason: string;
    movedTo: string | null;
    error?: string;
  }> = [];

  for (const card of candidates) {
    const id = card.notion_page_id as string;
    const name = (card.opportunity_name as string) ?? id;
    try {
      // getGoNoGoInputs is cheap — reads Supabase only, no AI calls.
      const inputs = await getGoNoGoInputs(id);
      const fit = inputs?.fit ?? (card.wv_fit_score as string) ?? "TBD";
      const winProb = inputs ? winProbability({
        wvFitScore: fit as "high fit" | "medium fit" | "low fit" | "TBD",
        serviceMatch: inputs.service_match,
        status: inputs.status,
        estimatedValue: inputs.estimated_value,
      } as Parameters<typeof winProbability>[0]) : 30;

      const { verdict, score: s, reason } = score(fit, winProb);

      await setBidDecision(id, {
        decision: verdict,
        score: s,
        reason,
        by: "biz-cron",
      });

      // Only auto-advance bid and no-bid — deferred stays on radar.
      const ADVANCE: Record<string, string | null> = {
        bid: "pursuing",
        "no-bid": "no-go",
        deferred: null,
      };
      const target = ADVANCE[verdict];
      if (target) {
        await transitionRfpStatus(id, target, { triggeredBy: "biz-cron" });
      }

      await createBizDecision({
        decision: `${verdict} (${s}/100)`,
        context: reason,
        category: "go-no-go",
        rfp_id: id,
        logged_by: "biz-cron",
      }).catch(() => {});

      results.push({ id, name, verdict, score: s, reason, movedTo: target });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[biz-go-no-go-sweep] failed for ${id}:`, msg);
      results.push({ id, name, verdict: "deferred", score: 0, reason: "error during sweep", movedTo: null, error: msg });
    }
  }

  // Post Slack digest — one line per card so the team can override.
  const bids     = results.filter((r) => r.verdict === "bid");
  const noBids   = results.filter((r) => r.verdict === "no-bid");
  const deferred = results.filter((r) => r.verdict === "deferred");

  const lines: string[] = [`*biz sweep — ${results.length} radar card${results.length !== 1 ? "s" : ""} reviewed*`];
  if (bids.length) {
    lines.push(`\n✅ *pursuing (${bids.length})*`);
    bids.forEach((r) => lines.push(`  • ${r.name} — ${r.reason}`));
  }
  if (deferred.length) {
    lines.push(`\n⏸ *deferred — needs human review (${deferred.length})*`);
    deferred.forEach((r) => lines.push(`  • ${r.name} — ${r.reason}`));
  }
  if (noBids.length) {
    lines.push(`\n❌ *no-go (${noBids.length})*`);
    noBids.forEach((r) => lines.push(`  • ${r.name} — ${r.reason}`));
  }
  lines.push(`\n_override any decision by opening the card in port_`);

  await postToChannel(CHANNEL, lines.join("\n")).catch((err) => {
    console.warn("[biz-go-no-go-sweep] Slack post failed (non-fatal):", err);
  });

  console.log(`[biz-go-no-go-sweep] swept ${results.length} cards:`, {
    bid: bids.length, deferred: deferred.length, noBid: noBids.length,
  });

  return NextResponse.json({
    swept: results.length,
    bid: bids.length,
    deferred: deferred.length,
    no_bid: noBids.length,
    results,
  });
}
