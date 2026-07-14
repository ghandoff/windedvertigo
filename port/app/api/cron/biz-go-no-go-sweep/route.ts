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
 * PLUS two aging passes so the queue never silently rots (a "deferred" verdict
 * sets bid_decision, which drops the card out of the query above forever —
 * nothing previously re-examined or timed it out; that's how items sat
 * unreviewed for months):
 *   1. auto-archive: any non-terminal opportunity whose due_date has passed
 *      moves to "missed deadline", regardless of bid_decision.
 *   2. stale-deferred re-surface: any card sitting at bid_decision='deferred'
 *      for >14 days gets logged + surfaced again in the digest — NOT
 *      auto-rejected, since BD opportunities are too valuable to auto-no-go
 *      without a human look.
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
const STALE_DEFERRED_DAYS = 14;
const TERMINAL = new Set(["won", "lost", "no-go", "missed deadline"]);

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

interface AgedResult {
  id: string;
  name: string;
  reason: string;
}

/** Pass 1: any non-terminal opportunity whose due_date has passed auto-archives. */
async function sweepPastDeadline(): Promise<AgedResult[]> {
  const today = new Date().toISOString().slice(0, 10);
  // Filter TERMINAL client-side rather than a hand-built PostgREST "not.in"
  // list — "missed deadline" contains a space, and this table's rows are few
  // enough (well under the 200-row limit here) that a JS filter is simpler
  // and safer than getting quoting right in a raw filter string.
  const { data: candidates, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, status, due_date")
    .not("due_date", "is", null)
    .lt("due_date", today)
    .limit(200);

  if (queryErr) {
    console.error("[biz-go-no-go-sweep] past-deadline query failed:", queryErr);
    return [];
  }
  const active = (candidates ?? []).filter((c) => !TERMINAL.has(c.status as string)).slice(0, 50);
  if (active.length === 0) return [];

  const results: AgedResult[] = [];
  for (const card of active) {
    const id = card.notion_page_id as string;
    const name = (card.opportunity_name as string) ?? id;
    const dueDate = card.due_date as string;
    const reason = `past due date (${dueDate}), auto-archived by aging sweep`;
    try {
      await transitionRfpStatus(id, "missed deadline", { triggeredBy: "biz-aging-sweep" });
      await createBizDecision({
        decision: "auto-archived (missed deadline)",
        context: reason,
        category: "auto-archive",
        rfp_id: id,
        logged_by: "biz-cron",
      }).catch(() => {});
      results.push({ id, name, reason });
    } catch (err) {
      console.error(`[biz-go-no-go-sweep] auto-archive failed for ${id}:`, err instanceof Error ? err.message : err);
    }
  }
  return results;
}

const RESURFACE_COOLDOWN_DAYS = 7;

/**
 * Pass 2: cards that scored "deferred" >14 days ago and were never revisited
 * (bid_decision='deferred' drops them out of the main sweep query forever).
 * Logged + re-surfaced in the digest, NOT auto-rejected — a human still has
 * to decide.
 *
 * Re-surfaced at most once every RESURFACE_COOLDOWN_DAYS per card — without
 * this a stale card would get logged and posted to the digest every single
 * day forever, recreating exactly the "daily posts into silence" fatigue
 * this whole aging sweep exists to fix.
 */
async function sweepStaleDeferred(): Promise<AgedResult[]> {
  const cutoff = new Date(Date.now() - STALE_DEFERRED_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: candidates, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, status, bid_decision_at")
    .eq("bid_decision", "deferred")
    .lt("bid_decision_at", cutoff)
    .limit(200);

  if (queryErr) {
    console.error("[biz-go-no-go-sweep] stale-deferred query failed:", queryErr);
    return [];
  }
  const active = (candidates ?? []).filter((c) => !TERMINAL.has(c.status as string)).slice(0, 50);
  if (active.length === 0) return [];

  const cooldownCutoff = new Date(Date.now() - RESURFACE_COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const results: AgedResult[] = [];
  for (const card of active) {
    const id = card.notion_page_id as string;
    const name = (card.opportunity_name as string) ?? id;

    const { data: recentlyResurfaced } = await supabase
      .from("biz_decisions")
      .select("id")
      .eq("rfp_id", id)
      .eq("category", "auto-defer-aging")
      .gte("created_at", cooldownCutoff)
      .limit(1);
    if (recentlyResurfaced && recentlyResurfaced.length > 0) continue; // already surfaced this week

    const deferredAt = (card.bid_decision_at as string)?.slice(0, 10);
    const reason = `unreviewed >${STALE_DEFERRED_DAYS} days since deferred on ${deferredAt} — resurfaced for human review`;
    await createBizDecision({
      decision: "resurfaced (stale deferred)",
      context: reason,
      category: "auto-defer-aging",
      rfp_id: id,
      logged_by: "biz-cron",
    }).catch(() => {});
    results.push({ id, name, reason });
  }
  return results;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Aging passes run every time, independent of whether there are new radar
  // cards to score below — otherwise the early-return on an empty radar
  // candidate list would skip them entirely.
  const [archived, staleDeferred] = await Promise.all([
    sweepPastDeadline(),
    sweepStaleDeferred(),
  ]);

  const cutoff = new Date(Date.now() - HOLD_HOURS * 60 * 60 * 1000).toISOString();

  // Fetch radar cards with no decision that have aged past the hold window.
  // NB: rfp_opportunities has no `created_at` column (only `updated_at`, set on
  // insert via DEFAULT now()). Referencing created_at made PostgREST 500 every
  // run. updated_at = "last touched", which is the right signal for "has sat
  // unreviewed past the hold window" anyway.
  const { data: candidates, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select("notion_page_id, opportunity_name, wv_fit_score, estimated_value, due_date")
    .eq("status", "radar")
    .is("bid_decision", null)
    .lt("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(30);

  if (queryErr) {
    console.error("[biz-go-no-go-sweep] query failed:", queryErr);
    return NextResponse.json({ error: queryErr.message }, { status: 500 });
  }

  if (!candidates || candidates.length === 0) {
    await postAgingDigest(archived, staleDeferred, []);
    return NextResponse.json({
      swept: 0,
      message: "no unreviewed radar cards",
      archived: archived.length,
      staleDeferred: staleDeferred.length,
    });
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

  const bids     = results.filter((r) => r.verdict === "bid");
  const noBids   = results.filter((r) => r.verdict === "no-bid");
  const deferred = results.filter((r) => r.verdict === "deferred");

  await postAgingDigest(archived, staleDeferred, results);

  console.log(`[biz-go-no-go-sweep] swept ${results.length} cards:`, {
    bid: bids.length, deferred: deferred.length, noBid: noBids.length,
    archived: archived.length, staleDeferred: staleDeferred.length,
  });

  return NextResponse.json({
    swept: results.length,
    bid: bids.length,
    deferred: deferred.length,
    no_bid: noBids.length,
    archived: archived.length,
    staleDeferred: staleDeferred.length,
    results,
  });
}

/** Post the combined digest — one line per card across all three passes so the team can override anything. */
async function postAgingDigest(
  archived: AgedResult[],
  staleDeferred: AgedResult[],
  scored: Array<{ id: string; name: string; verdict: Verdict; score: number; reason: string; movedTo: string | null }>,
): Promise<void> {
  const bids     = scored.filter((r) => r.verdict === "bid");
  const noBids   = scored.filter((r) => r.verdict === "no-bid");
  const deferred = scored.filter((r) => r.verdict === "deferred");

  if (scored.length === 0 && archived.length === 0 && staleDeferred.length === 0) return;

  const lines: string[] = [`*biz sweep*${scored.length ? ` — ${scored.length} radar card${scored.length !== 1 ? "s" : ""} reviewed` : ""}`];
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
  if (archived.length) {
    lines.push(`\n🗄 *auto-archived — past deadline (${archived.length})*`);
    archived.forEach((r) => lines.push(`  • ${r.name} — ${r.reason}`));
  }
  if (staleDeferred.length) {
    lines.push(`\n👀 *needs a human look — unreviewed >${STALE_DEFERRED_DAYS} days (${staleDeferred.length})*`);
    staleDeferred.forEach((r) => lines.push(`  • ${r.name} — ${r.reason}`));
  }
  lines.push(`\n_override any decision by opening the card in port_`);

  await postToChannel(CHANNEL, lines.join("\n")).catch((err) => {
    console.warn("[biz-go-no-go-sweep] Slack post failed (non-fatal):", err);
  });
}
