/**
 * POST /api/agent/slack/interactive
 *
 * Slack "Interactivity & Shortcuts" receiver — the FIRST block_actions
 * handler in this codebase. Handles approve/edit/redirect/ignore clicks on
 * agent_interventions preview cards (docs/prompts/executive-agents-phase1-build.md
 * §2.4). Requires a new Request URL configured in the wv-claw Slack app
 * (api.slack.com) — a human gate, not auto-provisioned by this code.
 *
 * Slack sends this as `application/x-www-form-urlencoded` with a `payload=`
 * field (unlike the Events API's raw JSON) — still HMAC-signed over the raw
 * body the same way, so verifySlackSignature (lib/slack-verify.ts, shared
 * with the events route) works unchanged.
 */

import { NextRequest, NextResponse, after } from "next/server";
import { verifySlackSignature } from "@/lib/slack-verify";
import { getSlackUserEmail } from "@/lib/slack";
import {
  getIntervention,
  resolveIntervention,
  setInterventionStatus,
  type InterventionStatus,
} from "@/lib/supabase/agent-interventions";
import { executeApprovedIntervention } from "@/lib/agent/intervention-executors";
import { buildResolvedBlocks, interventionFallbackText } from "@/lib/agent/intervention-card";

interface SlackBlockAction {
  action_id?: string;
  value?: string;
}

interface SlackInteractivePayload {
  type?: string;
  user?: { id?: string; username?: string };
  actions?: SlackBlockAction[];
  response_url?: string;
}

const DECISION_STATUS: Record<string, Exclude<InterventionStatus, "proposed" | "expired" | "executed">> = {
  approve: "approved",
  edit: "edited",
  redirect: "redirected",
  ignore: "ignored",
};

async function handleAction(payload: SlackInteractivePayload): Promise<void> {
  const action = payload.actions?.[0];
  const [prefix, decision] = (action?.action_id ?? "").split(":");
  if (prefix !== "intervention" || !decision || !action?.value || !payload.response_url) return;

  const status = DECISION_STATUS[decision];
  if (!status) return;

  const userId = payload.user?.id;
  const email = (userId ? await getSlackUserEmail(userId) : null) ?? payload.user?.username ?? "unknown";

  const resolved = await resolveIntervention(action.value, status, email);
  if (!resolved) {
    // Already resolved (race with another click, or expired underneath) —
    // still refresh the card so the human sees the real current state.
    const current = await getIntervention(action.value);
    if (current && payload.response_url) {
      await postResponseUrl(payload.response_url, current);
    }
    return;
  }

  let row = await getIntervention(action.value);
  if (!row) return;

  if (status === "approved") {
    const result = await executeApprovedIntervention(row);
    await setInterventionStatus(action.value, result.ok ? "executed" : "approved", result.note);
    row = await getIntervention(action.value);
    if (!row) return;
  }

  await postResponseUrl(payload.response_url, row);
}

async function postResponseUrl(
  responseUrl: string,
  row: NonNullable<Awaited<ReturnType<typeof getIntervention>>>,
): Promise<void> {
  try {
    await fetch(responseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        replace_original: true,
        text: interventionFallbackText(row),
        blocks: buildResolvedBlocks(row),
      }),
    });
  } catch (err) {
    console.warn("[slack/interactive] response_url post failed:", err);
  }
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const timestamp = req.headers.get("x-slack-request-timestamp") ?? "";
  const signature = req.headers.get("x-slack-signature") ?? "";

  if (!verifySlackSignature(rawBody, timestamp, signature)) {
    return NextResponse.json({ error: "invalid signature" }, { status: 401 });
  }

  const params = new URLSearchParams(rawBody);
  const raw = params.get("payload");
  if (!raw) return NextResponse.json({ ok: true });

  let payload: SlackInteractivePayload;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (payload.type !== "block_actions") return NextResponse.json({ ok: true });

  // Ack within Slack's 3s budget; the resolve + execute + response_url
  // update happens after, same after()-past-the-ack pattern as the events
  // route.
  after(handleAction(payload));

  return NextResponse.json({ ok: true });
}
