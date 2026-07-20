/**
 * POST /api/agent/interventions/[id]
 *
 * Web-based approve/edit/redirect/ignore for an agent_interventions row —
 * the /inbox InterventionCard's write path, session-gated (mirrors
 * /api/review/[id]'s auth posture). Same resolve+execute logic as the Slack
 * interactive route (app/api/agent/slack/interactive/route.ts) — a human can
 * resolve a card from either surface, whichever they saw first, per the
 * spec's "port /agents/inbox tab ... same actions" (§2.4).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getIntervention,
  resolveIntervention,
  setInterventionStatus,
  type InterventionStatus,
} from "@/lib/supabase/agent-interventions";
import { executeApprovedIntervention } from "@/lib/agent/intervention-executors";

type Decision = "approve" | "edit" | "redirect" | "ignore";

const DECISION_STATUS: Record<Decision, Exclude<InterventionStatus, "proposed" | "expired" | "executed">> = {
  approve: "approved",
  edit: "edited",
  redirect: "redirected",
  ignore: "ignored",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: { action?: Decision };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const status = body.action ? DECISION_STATUS[body.action] : undefined;
  if (!status) return NextResponse.json({ error: "invalid_action" }, { status: 400 });

  const resolved = await resolveIntervention(id, status, session.user.email);
  if (!resolved) {
    return NextResponse.json({ error: "already_resolved_or_not_found" }, { status: 409 });
  }

  let row = await getIntervention(id);
  if (status === "approved" && row) {
    const result = await executeApprovedIntervention(row);
    await setInterventionStatus(id, result.ok ? "executed" : "approved", result.note);
    row = await getIntervention(id);
  }

  return NextResponse.json({ ok: true, intervention: row });
}
