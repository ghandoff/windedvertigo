/**
 * GET /api/cron/mo-content-runway-check
 *
 * Daily. Mo pilot behavior #2 (charter: "stale content queue (<2 weeks
 * runway) → fills it", MEDIUM tier). The content queue is `compose_drafts`
 * (lib/supabase/compose-drafts.ts) — the /compose authoring surface that
 * routes to LinkedIn/Bluesky/Substack/Meta/Email at publish time; NOT
 * `campaign_steps` (that's outbound email-sequence scheduling, a different
 * concept confirmed via schema check before writing this route).
 *
 * "Fills it" = drafts ONE filler post into compose_drafts as `status:
 * "draft"` (unscheduled — a human still schedules it from /compose) and logs
 * + notifies via an agent_interventions row. Reversible, no external send —
 * correctly MEDIUM, not HIGH.
 */

import { NextRequest, NextResponse } from "next/server";
import { listComposeDrafts, createComposeDraft } from "@/lib/supabase/compose-drafts";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { CHARTERS } from "@/lib/agent/charters.generated";
import { insertIntervention, setInterventionStatus } from "@/lib/supabase/agent-interventions";
import { postToChannelResilientDetailed } from "@/lib/slack";
import { ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const RUNWAY_THRESHOLD_DAYS = 14;
const MO_AGENT_AUTHOR_EMAIL = "mo-agent@port.windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const scheduled = await listComposeDrafts({ status: "scheduled", limit: 200 });
  const latestScheduledFor = scheduled
    .map((d) => (d.scheduledFor ? new Date(d.scheduledFor).getTime() : null))
    .filter((t): t is number => t !== null)
    .sort((a, b) => b - a)[0];

  const runwayDays = latestScheduledFor
    ? Math.floor((latestScheduledFor - Date.now()) / (24 * 60 * 60 * 1000))
    : 0;

  if (runwayDays >= RUNWAY_THRESHOLD_DAYS) {
    return NextResponse.json({ runwayDays, action: "none" });
  }

  const system =
    `${CHARTERS.mo}\n\nThe content queue's runway just dropped below 14 days ` +
    `(${runwayDays} day(s) of scheduled content left). Draft ONE short filler ` +
    `LinkedIn post idea in your voice. Respond with strict JSON only: ` +
    `{"title":"...","body":"..."}`;
  let draftText: { title: string; body: string };
  try {
    const result = await callClaude({
      feature: "ambient-agent-run",
      system,
      userMessage: "Draft the filler post.",
      userId: "ambient:mo",
      maxTokens: 512,
    });
    draftText = parseJsonResponse(result.text);
  } catch (err) {
    console.warn("[cron/mo-content-runway-check] draft generation failed:", err);
    return NextResponse.json({ runwayDays, action: "draft_failed" }, { status: 500 });
  }

  const draft = await createComposeDraft({
    authorEmail: MO_AGENT_AUTHOR_EMAIL,
    channel: "linkedin",
    title: draftText.title,
    contentText: draftText.body,
  });

  const row = await insertIntervention({
    agent: "mo",
    decision: "act_notify",
    riskTier: "medium",
    trigger: `content queue runway is ${runwayDays} day(s) (<${RUNWAY_THRESHOLD_DAYS})`,
    artifact: { title: draftText.title, body: draftText.body, composeDraftId: draft?.id ?? null },
    rationale: "charter: stale content queue → fills it",
  });
  if (row) {
    await postToChannelResilientDetailed(
      ambientNotifyChannel(),
      `🟡 Mo — content queue runway is ${runwayDays} day(s), drafted a filler post (unscheduled, waiting on /compose review): *${draftText.title}*`,
    );
    await setInterventionStatus(row.id, "executed");
  }

  return NextResponse.json({ runwayDays, action: "drafted", composeDraftId: draft?.id ?? null });
}
