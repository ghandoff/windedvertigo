/**
 * POST /api/council/actions/[id]/promote-to-commitment
 *
 * The council → PaM bridge. Resolves a triaged meeting action item into the
 * PaM whirlpool board. Mirrors the sibling promote-to-Notion-work-item route.
 *
 * Body: { decision, cycle?, commitmentType?, priority?, mergeWith?, visibility? }
 *   decision = "accept"  → create a new pam_commitment from the action
 *            = "merge"   → link the action to an existing commitment (no new row)
 *            = "dismiss" → mark the action dismissed, create nothing
 *
 * Overrides (cycle / commitmentType / priority / mergeWith / visibility) let the
 * human tweak PaM's triage suggestion at accept time; when omitted we fall back
 * to the stored triage_suggestion, then to sensible defaults.
 *
 * Idempotent via meeting_action_items.pam_commitment_id — a second accept/merge
 * returns the existing link instead of creating a duplicate commitment.
 *
 * Auth: any signed-in port user (same posture as the work-item promote route).
 *
 * Core logic lives in lib/pam/promote-commitment.ts — this route is now a
 * thin auth+params wrapper so the ambient-spine's owner-confirmation-DM flow
 * (lib/agent/intervention-executors.ts) can call the same logic directly
 * from a cron/interactive-button context with no HTTP self-fetch/session.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { promoteActionToCommitment, type PromoteDecision } from "@/lib/pam/promote-commitment";
import type { CommitmentType } from "@/lib/ai/pam-triage";

export const maxDuration = 60;

interface PromoteBody {
  decision: PromoteDecision;
  cycle?: string | null;
  commitmentType?: CommitmentType;
  priority?: "low" | "medium" | "high";
  mergeWith?: string;
  visibility?: "public" | "private";
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: PromoteBody;
  try {
    body = (await req.json()) as PromoteBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const result = await promoteActionToCommitment(id, body.decision, {
    cycle: body.cycle,
    commitmentType: body.commitmentType,
    priority: body.priority,
    mergeWith: body.mergeWith,
    visibility: body.visibility,
  });

  if (!result.ok) {
    const status = result.error === "not_found" ? 404 : result.error === "no_merge_target" ? 400 : 500;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
