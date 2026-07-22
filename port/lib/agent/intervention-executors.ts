/**
 * What "approve executes" actually does, per artifact type
 * (docs/prompts/executive-agents-phase1-build.md §2.4). ambient-run.ts
 * attaches `artifact.executeAction = { type, ...params }` when an
 * intervention has a concrete follow-up write; the interactive route
 * (app/api/agent/slack/interactive/route.ts) and the owner-confirmation
 * sweep cron both call this on approve.
 *
 * Phase 1 registers exactly one concrete type — pam_promote_commitment,
 * wired to the existing council→PaM bridge (lib/pam/promote-commitment.ts).
 * Everything else falls through to "approval recorded, no further write" —
 * correct for phase-1 Mo behaviors, none of which have a real publish
 * integration yet (charter: external publication is HIGH-tier and this repo
 * has no LinkedIn/CMS API to call regardless).
 */

import { promoteActionToCommitment } from "@/lib/pam/promote-commitment";
import { updateRfpOpportunity } from "@/lib/notion/rfp-radar";
import type { InterventionRow } from "@/lib/supabase/agent-interventions";

export interface ExecuteResult {
  ok: boolean;
  note?: string;
}

export async function executeApprovedIntervention(
  row: InterventionRow,
): Promise<ExecuteResult> {
  const action = row.artifact?.executeAction as
    | { type?: string; [key: string]: unknown }
    | undefined;

  if (!action?.type) {
    return { ok: true, note: "no execute action attached — approval recorded only" };
  }

  switch (action.type) {
    case "pam_promote_commitment": {
      const meetingActionItemId = action.meetingActionItemId as string | undefined;
      if (!meetingActionItemId) {
        return { ok: false, note: "missing meetingActionItemId" };
      }
      const result = await promoteActionToCommitment(meetingActionItemId, "accept");
      if (!result.ok) return { ok: false, note: result.error };
      return {
        ok: true,
        note: result.alreadyLinked
          ? `already linked to commitment ${result.commitmentId}`
          : `commitment created: ${result.commitmentId}`,
      };
    }
    case "biz_set_estimated_value": {
      // Biz proposed an estimated value for an RFP; on approve, write it to
      // NOTION (the source of truth) — the hourly Notion→Supabase sync then
      // flows it to rfp_opportunities.estimated_value. Writing to Supabase
      // directly would be clobbered by the next sync.
      const notionPageId = action.notionPageId as string | undefined;
      const value = action.value as number | undefined;
      if (!notionPageId || typeof value !== "number" || !Number.isFinite(value)) {
        return { ok: false, note: "missing notionPageId or invalid value" };
      }
      await updateRfpOpportunity(notionPageId, { estimatedValue: value });
      return { ok: true, note: `wrote estimated value $${value.toLocaleString("en-US")} to Notion` };
    }
    default:
      return { ok: false, note: `unknown executeAction type "${action.type}"` };
  }
}
