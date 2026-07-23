/**
 * Council → PaM bridge core logic — resolves a triaged meeting action item
 * into the PaM whirlpool board. Extracted from
 * app/api/council/actions/[id]/promote-to-commitment/route.ts (which now
 * calls this as a thin auth+params wrapper) so the ambient-spine's
 * pam-owner-confirmation-sweep cron / interactive-button executor
 * (lib/agent/intervention-executors.ts) can call the same logic directly —
 * no HTTP self-fetch, no session/auth concern in a cron context.
 *
 * Idempotent via meeting_action_items.pam_commitment_id — a second accept/
 * merge returns the existing link instead of creating a duplicate commitment.
 */

import {
  getActionItem,
  setActionPamCommitmentId,
  setActionTriage,
} from "@/lib/supabase/meeting-action-items";
import { insertPamCommitment } from "@/lib/supabase/pam";
import { currentCycleMonday } from "@/lib/pam/cycle";
import type { CommitmentType } from "@/lib/ai/pam-triage";

export type PromoteDecision = "accept" | "merge" | "dismiss";

export interface PromoteOptions {
  cycle?: string | null;
  commitmentType?: CommitmentType;
  priority?: "low" | "medium" | "high";
  mergeWith?: string;
  visibility?: "public" | "private";
}

export interface PromoteResult {
  ok: boolean;
  commitmentId?: string;
  alreadyLinked?: boolean;
  dismissed?: boolean;
  merged?: boolean;
  warning?: string;
  error?: string;
}

/** pam_commitments.who is a lowercase first name; derive from email/name. */
function resolveWho(ownerEmail: string | null, ownerName: string | null): string {
  if (ownerEmail) return ownerEmail.split("@")[0].toLowerCase();
  if (ownerName) return ownerName.trim().split(/\s+/)[0].toLowerCase();
  return "unassigned";
}

export async function promoteActionToCommitment(
  id: string,
  decision: PromoteDecision,
  opts: PromoteOptions = {},
): Promise<PromoteResult> {
  const action = await getActionItem(id);
  if (!action) return { ok: false, error: "not_found" };

  if (action.pamCommitmentId) {
    return { ok: true, alreadyLinked: true, commitmentId: action.pamCommitmentId };
  }

  const suggestion = action.triageSuggestion;

  if (decision === "dismiss") {
    await setActionTriage(id, "dismissed", suggestion);
    return { ok: true, dismissed: true };
  }

  if (decision === "merge") {
    const target = opts.mergeWith ?? suggestion?.mergeWith ?? null;
    if (!target) return { ok: false, error: "no_merge_target" };
    const linked = await setActionPamCommitmentId(id, target, "merged");
    if (!linked) return { ok: false, error: "merge_link_failed" };
    return { ok: true, merged: true, commitmentId: target };
  }

  // decision === "accept"
  const cycle =
    opts.cycle !== undefined ? opts.cycle : suggestion?.suggestedCycle ?? currentCycleMonday();
  const commitmentType = opts.commitmentType ?? suggestion?.suggestedType ?? "action";
  // Accept IS the human review gate, so the commitment goes straight onto the
  // public whirlpool board unless the caller explicitly keeps it private.
  const visibility = opts.visibility ?? "public";

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
      return {
        ok: true,
        commitmentId: commitment.id,
        warning: "commitment created but back-link save failed",
      };
    }
    return { ok: true, commitmentId: commitment.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`[pam/promote-commitment] failed for ${id}:`, message);
    return { ok: false, error: "promote_failed" };
  }
}
