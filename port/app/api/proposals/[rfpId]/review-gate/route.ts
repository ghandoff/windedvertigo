/**
 * POST /api/proposals/[rfpId]/review-gate
 *
 * Advances or reverts the proposal_review_stage for an RFP.
 * Auth: session (dashboard user).
 *
 * Body: { action, notes? }
 *
 * Stage transitions:
 *   advance  v1-generated  → biz-review
 *   advance  biz-review    → human-review
 *   approve  human-review  → approved
 *   export   approved      → exported
 *   submit   exported      → submitted
 *   revise   any           → one stage back
 *   jump     any           → any later stage (requires targetStage in body)
 */

import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { json, error } from "@/lib/api-helpers";
import { setProposalReviewStage } from "@/lib/supabase/rfp-opportunities";
import { supabase } from "@/lib/supabase/client";

type Action = "advance" | "approve" | "revise" | "export" | "submit" | "jump";

const STAGE_ORDER = [
  "v1-generated",
  "biz-review",
  "human-review",
  "approved",
  "exported",
  "submitted",
] as const;

type Stage = (typeof STAGE_ORDER)[number];

function resolveTarget(current: Stage, action: Action, targetStage?: string): Stage | null {
  const idx = STAGE_ORDER.indexOf(current);
  if (idx === -1) return null;

  switch (action) {
    case "advance":
      if (current === "v1-generated") return "biz-review";
      if (current === "biz-review") return "human-review";
      return null;
    case "approve":
      if (current === "human-review") return "approved";
      return null;
    case "export":
      if (current === "approved") return "exported";
      return null;
    case "submit":
      if (current === "exported") return "submitted";
      return null;
    case "revise":
      return idx > 0 ? STAGE_ORDER[idx - 1] : null;
    case "jump": {
      if (!targetStage || !(STAGE_ORDER as readonly string[]).includes(targetStage)) return null;
      const target = targetStage as Stage;
      const targetIdx = STAGE_ORDER.indexOf(target);
      // must move forward (or at least not be the same stage)
      if (targetIdx <= idx) return null;
      return target;
    }
  }
}

const VALID_ACTIONS: Action[] = ["advance", "approve", "revise", "export", "submit", "jump"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ rfpId: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) return error("unauthorized", 401);

  const { rfpId } = await params;
  const body = await req.json().catch(() => null);
  const action: Action = body?.action;
  const notes: string | undefined = body?.notes;
  const targetStage: string | undefined = body?.targetStage;

  if (!action || !VALID_ACTIONS.includes(action)) {
    return error(`action must be one of: ${VALID_ACTIONS.join(", ")}`);
  }
  if (action === "jump" && !targetStage) {
    return error("targetStage is required for action 'jump'");
  }

  const { data: row, error: queryErr } = await supabase
    .from("rfp_opportunities")
    .select("proposal_review_stage")
    .eq("notion_page_id", rfpId)
    .single();

  if (queryErr || !row) return error("rfp not found", 404);

  const current = row.proposal_review_stage as Stage | null;
  if (!current) return error("no proposal_review_stage set — generate a proposal first");

  const target = resolveTarget(current, action, targetStage);
  if (!target) {
    return error(`cannot apply action '${action}' from stage '${current}'${targetStage ? ` to '${targetStage}'` : ""}`);
  }

  await setProposalReviewStage(rfpId, target, session.user.email, {
    action,
    stageFrom: current,
    notes,
  });

  return json({ rfpId, stagePrev: current, stageNow: target, action });
}
