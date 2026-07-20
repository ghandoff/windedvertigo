/**
 * GET /api/cron/pam-owner-confirmation-sweep
 *
 * Every 15 minutes (lib/scheduled.ts FIFTEEN_MINUTE_PATHS). PaM pilot
 * behavior #1 (charter: "meeting ends → harvested commitments to each
 * owner's DM for confirmation within the hour ... that confirmation IS the
 * human gate").
 *
 * Reuses the EXISTING extraction/triage pipeline
 * (meet-transcript-ingest → extractMeetingActions → pam-action-triage →
 * triageActions) — this cron does NOT re-extract or re-triage anything. It
 * picks up items PaM's triage cron already judged `meaningful`, still
 * awaiting a decision (triage_state='pending'), and DMs the actual owner
 * instead of waiting for Garrett/Maria to accept on their behalf in /pam.
 * This moves the human gate to the person the charter names — the owner —
 * rather than the person(s) currently triaging on /pam's behalf.
 *
 * The two paths don't conflict: promoteActionToCommitment() is idempotent
 * on meeting_action_items.pam_commitment_id, so if Garrett/Maria accept in
 * /pam before the owner clicks Approve here (or vice versa), the second
 * resolution is a safe no-op.
 *
 * No new "already DMed" column — dedup is done by scanning recent PaM
 * agent_interventions for this meetingActionItemId (listRecentByAgent),
 * same pattern the metrics query already uses for client-side artifact scans.
 */

import { NextRequest, NextResponse } from "next/server";
import { listPendingTriageActions } from "@/lib/supabase/meeting-action-items";
import {
  insertIntervention,
  listRecentByAgent,
} from "@/lib/supabase/agent-interventions";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { buildInterventionBlocks, interventionFallbackText } from "@/lib/agent/intervention-card";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const MAX_PER_RUN = 10;
const EXPIRES_HOURS = 72;

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

function alreadyHandledIds(recent: Awaited<ReturnType<typeof listRecentByAgent>>): Set<string> {
  const ids = new Set<string>();
  for (const row of recent) {
    const action = row.artifact?.executeAction as { type?: string; meetingActionItemId?: string } | undefined;
    if (action?.type === "pam_promote_commitment" && action.meetingActionItemId) {
      ids.add(action.meetingActionItemId);
    }
  }
  return ids;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [pending, recentPam] = await Promise.all([
    listPendingTriageActions(),
    listRecentByAgent("pam", 7),
  ]);
  const handled = alreadyHandledIds(recentPam);

  const candidates = pending
    .filter((item) => item.ownerEmail && item.triageSuggestion?.meaningful && !handled.has(item.id))
    .slice(0, MAX_PER_RUN);

  const dmsAllowed = ambientDirectDmsAllowed();
  let dmed = 0;
  for (const item of candidates) {
    const deadlineNote = item.deadline ? ` — due ${item.deadline}` : "";
    const row = await insertIntervention({
      agent: "pam",
      decision: "preview",
      riskTier: "medium",
      trigger: `meeting action item harvested from a meeting: "${item.title}"`,
      artifact: {
        title: item.title,
        body: `${item.title}${deadlineNote}\n\ncan you confirm this is something you're taking on?`,
        executeAction: { type: "pam_promote_commitment", meetingActionItemId: item.id },
      },
      rationale: "charter: harvested commitments → owner DM for confirmation; that confirmation IS the human gate",
      channel: `dm:${item.ownerEmail}`,
      expiresAt: new Date(Date.now() + EXPIRES_HOURS * 60 * 60 * 1000).toISOString(),
      targetHuman: item.ownerEmail,
    });
    if (!row) continue;

    const blocks = buildInterventionBlocks(row);
    const text = interventionFallbackText(row);
    const sent = dmsAllowed
      ? await sendDmByEmail(item.ownerEmail!, text, blocks)
      : (await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${item.ownerEmail}]\n${text}`, [], blocks)).posted;
    if (sent) dmed += 1;
  }

  return NextResponse.json({ candidates: candidates.length, dmed });
}
