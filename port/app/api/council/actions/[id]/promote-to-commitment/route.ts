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
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getActionItem,
  setActionPamCommitmentId,
  setActionTriage,
} from "@/lib/supabase/meeting-action-items";
import { insertPamCommitment } from "@/lib/supabase/pam";
import { currentCycleMonday } from "@/lib/pam/cycle";
import type { CommitmentType } from "@/lib/ai/pam-triage";

export const maxDuration = 60;

type Decision = "accept" | "merge" | "dismiss";

interface PromoteBody {
  decision: Decision;
  cycle?: string | null;
  commitmentType?: CommitmentType;
  priority?: "low" | "medium" | "high";
  mergeWith?: string;
  visibility?: "public" | "private";
}

/** pam_commitments.who is a lowercase first name; derive from email/name. */
function resolveWho(ownerEmail: string | null, ownerName: string | null): string {
  if (ownerEmail) return ownerEmail.split("@")[0].toLowerCase();
  if (ownerName) return ownerName.trim().split(/\s+/)[0].toLowerCase();
  return "unassigned";
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
  const action = await getActionItem(id);
  if (!action) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Already bridged — return the existing link rather than create a dupe.
  if (action.pamCommitmentId) {
    return NextResponse.json({
      ok: true,
      alreadyLinked: true,
      commitmentId: action.pamCommitmentId,
    });
  }

  let body: PromoteBody;
  try {
    body = (await req.json()) as PromoteBody;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const decision = body.decision;
  const suggestion = action.triageSuggestion;

  // ── dismiss ───────────────────────────────────────────────────────────────
  if (decision === "dismiss") {
    await setActionTriage(id, "dismissed", suggestion);
    return NextResponse.json({ ok: true, dismissed: true });
  }

  // ── merge into an existing commitment ───────────────────────────────────────
  if (decision === "merge") {
    const target = body.mergeWith ?? suggestion?.mergeWith ?? null;
    if (!target) {
      return NextResponse.json({ error: "no_merge_target" }, { status: 400 });
    }
    const linked = await setActionPamCommitmentId(id, target, "merged");
    if (!linked) {
      return NextResponse.json({ error: "merge_link_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, merged: true, commitmentId: target });
  }

  // ── accept → create a new commitment ────────────────────────────────────────
  if (decision === "accept") {
    const cycle =
      body.cycle !== undefined ? body.cycle : suggestion?.suggestedCycle ?? currentCycleMonday();
    const commitmentType = body.commitmentType ?? suggestion?.suggestedType ?? "action";
    // Accept IS the human review gate, so the commitment goes straight onto the
    // public whirlpool board unless the caller explicitly keeps it private.
    const visibility = body.visibility ?? "public";

    try {
      const commitment = await insertPamCommitment({
        who: resolveWho(action.ownerEmail, action.ownerName),
        what: action.title,
        due_date: action.deadline ?? undefined,
        source: `council: ${action.meetingId}`,
        cycle: cycle ?? undefined,
        commitment_type: commitmentType,
        visibility,
      });

      const linked = await setActionPamCommitmentId(id, commitment.id, "accepted");
      if (!linked) {
        // Commitment exists but back-link failed — return success so the user
        // sees it; a re-accept will detect the dangling action and can retry.
        return NextResponse.json({
          ok: true,
          commitmentId: commitment.id,
          warning: "commitment created but back-link save failed",
        });
      }
      return NextResponse.json({ ok: true, commitmentId: commitment.id });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      console.warn(`[council/actions/promote-to-commitment] failed for ${id}:`, message);
      return NextResponse.json({ error: "promote_failed", message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "invalid_decision" }, { status: 400 });
}
