/**
 * POST /api/biz/bid-decision — record a go/no-go: writes the canonical
 * bid_decision* columns on rfp_opportunities and logs a biz_decision.
 * Auth: Bearer CMO_API_TOKEN.
 *
 * Body: { rfp_id, decision: 'bid'|'no-bid'|'deferred', score?, reason?, by? }
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { setBidDecision } from "@/lib/supabase/rfp-opportunities";
import { transitionRfpStatus } from "@/lib/rfp/transition";
import { createBizDecision } from "@/lib/biz-data";

const VALID = new Set(["bid", "no-bid", "deferred"]);

// recording a verdict also moves the card off radar: bid → pursuing,
// no-bid → no-go. deferred stays put (it's a "watch, revisit later"). Opt out
// with advance_status: false.
const ADVANCE: Record<string, string | null> = { bid: "pursuing", "no-bid": "no-go", deferred: null };

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => null);
  if (!body?.rfp_id) return error("rfp_id is required");
  if (!body?.decision || !VALID.has(body.decision)) {
    return error("decision must be one of: bid, no-bid, deferred");
  }

  try {
    await setBidDecision(body.rfp_id, {
      decision: body.decision,
      score: typeof body.score === "number" ? body.score : null,
      reason: body.reason ?? null,
      by: body.by ?? "biz",
    });

    // move the card unless the caller opted out — through the SHARED transition
    // path (Supabase + Notion + side-effects), so a Biz decision and a board drag
    // persist identically and survive the Notion→Supabase sync.
    let movedTo: string | null = null;
    if (body.advance_status !== false) {
      const target = ADVANCE[body.decision];
      if (target) {
        await transitionRfpStatus(body.rfp_id, target, { triggeredBy: body.by ?? "biz" });
        movedTo = target;
      }
    }

    await createBizDecision({
      decision: `${body.decision}${typeof body.score === "number" ? ` (${body.score}/100)` : ""}`,
      context: body.reason ?? undefined,
      category: "go-no-go",
      rfp_id: body.rfp_id,
      logged_by: body.by ?? "biz",
    }).catch(() => {});
    return json({ ok: true, rfp_id: body.rfp_id, decision: body.decision, score: body.score ?? null, moved_to: movedTo });
  } catch (err) {
    console.error("[api/biz/bid-decision] POST failed:", err);
    return error("failed to record bid decision", 500);
  }
}
