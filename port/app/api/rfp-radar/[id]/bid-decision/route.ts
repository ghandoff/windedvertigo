/**
 * POST /api/rfp-radar/[id]/bid-decision
 *
 * Captures the bid/no-bid scorecard decision when the user drags an RFP from
 * `reviewing → pursuing` in the kanban. This is the lifecycle's first-class
 * commit point — analogous to Loopio/Responsive bid-gate.
 *
 * Body shape:
 *   {
 *     decision: "bid" | "no-bid" | "deferred",
 *     score: number,                  // computed scorecard total (0–100)
 *     reason?: string,                // free text — REQUIRED when decision='no-bid'
 *     scorecard: {
 *       strategicFit:      boolean,   // weight 25
 *       capacityAvailable: boolean,   // weight 20
 *       teamHasExpertise:  boolean,   // weight 25
 *       budgetAcceptable:  boolean,   // weight 15
 *       timelineWorkable:  boolean,   // weight 15
 *     }
 *   }
 *
 * On bid='bid':
 *   - status moves to 'pursuing' (kanban column)
 *   - milestone schedule auto-generated from RFP deadline
 *   - bid_decision fields persisted
 *   - returns generated milestones in the response so the UI can render them
 *
 * On bid='no-bid':
 *   - status stays/moves back as appropriate (caller decides)
 *   - reason captured for win/loss learning
 *   - no milestones generated
 *
 * On 'deferred': just records the decision, kanban transition is the caller's choice.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { supabase } from "@/lib/supabase/client";
import {
  buildMilestoneSchedule,
  insertMilestones,
} from "@/lib/supabase/rfp-milestones";
import { checkEligibilityGate } from "@/lib/supabase/rfp-requirements";

type Decision = "bid" | "no-bid" | "deferred";

interface PostBody {
  decision: Decision;
  score: number;
  reason?: string;
  scorecard: {
    strategicFit: boolean;
    capacityAvailable: boolean;
    teamHasExpertise: boolean;
    budgetAcceptable: boolean;
    timelineWorkable: boolean;
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: PostBody;
  try {
    body = (await req.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!["bid", "no-bid", "deferred"].includes(body.decision)) {
    return NextResponse.json({ error: "invalid decision" }, { status: 400 });
  }
  if (body.decision === "no-bid" && !body.reason?.trim()) {
    return NextResponse.json(
      { error: "reason required for no-bid decisions (used for win/loss learning)" },
      { status: 400 },
    );
  }

  // BIZ-E1 — eligibility hard gate.
  // A 'bid' verdict is only permitted when every required eligibility check has
  // a recorded verdict and none are uncovered fails. This is enforced here in
  // code, not left to the agent's discretion. Rules defined in:
  // .brain/memory/biz/bid-eligibility-screen.md
  let eligibilityChecks: Awaited<ReturnType<typeof checkEligibilityGate>>["checks"] = [];
  if (body.decision === "bid") {
    const eligibility = await checkEligibilityGate(id);
    eligibilityChecks = eligibility.checks;
    if (!eligibility.passed) {
      const detail =
        eligibility.blockingReason === "incomplete"
          ? `eligibility check not yet assessed: "${eligibility.blockingCheck}"`
          : `uncovered eligibility fail: "${eligibility.blockingCheck}" — add a named partner or covered entity with evidence to proceed`;
      return NextResponse.json(
        {
          error: "eligibility_gate_blocked",
          blockingCheck: eligibility.blockingCheck,
          blockingReason: eligibility.blockingReason,
          detail,
          eligibilityChecks: eligibility.checks,
        },
        { status: 422 },
      );
    }
  }

  // Persist the decision on rfp_opportunities
  const decisionAt = new Date().toISOString();
  const update: Record<string, unknown> = {
    bid_decision: body.decision,
    bid_decision_at: decisionAt,
    bid_decision_by: session.user.email,
    bid_decision_score: body.score,
    bid_decision_reason: body.reason ?? null,
  };
  // On bid, also flip status to pursuing if not already
  if (body.decision === "bid") {
    update.status = "pursuing";
  }

  // Pull due_date for the milestone schedule (only for bid decisions)
  const { data: rfp, error: rfpErr } = await supabase
    .from("rfp_opportunities")
    .update(update)
    .eq("notion_page_id", id)
    .select("due_date, opportunity_name, organization_ids")
    .single();

  if (rfpErr) {
    console.error("[bid-decision] update failed:", rfpErr);
    return NextResponse.json({ error: "decision write failed", detail: rfpErr.message }, { status: 500 });
  }

  let milestones: Awaited<ReturnType<typeof insertMilestones>> = [];

  if (body.decision === "bid") {
    if (!rfp?.due_date) {
      console.warn(`[bid-decision] ${id} marked bid but has no due_date — skipping milestone generation`);
    } else {
      try {
        const template = buildMilestoneSchedule(id, rfp.due_date as string, session.user.email);
        milestones = await insertMilestones(template);
        console.warn(
          `[bid-decision] ${id} → bid · ${milestones.length} milestones generated · due ${rfp.due_date}`,
        );
      } catch (err) {
        // Milestone failure is non-fatal — the decision itself landed. UI can
        // surface a "milestones not yet generated" warning and offer a retry.
        console.error("[bid-decision] milestone generation failed:", err);
      }
    }
  } else {
    console.warn(
      `[bid-decision] ${id} → ${body.decision}${body.reason ? ` · reason: ${body.reason.slice(0, 100)}` : ""}`,
    );
  }

  return NextResponse.json({
    ok: true,
    decision: body.decision,
    score: body.score,
    decisionAt,
    decisionBy: session.user.email,
    milestones,
    eligibilityChecks,
  });
}
