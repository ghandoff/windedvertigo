/**
 * GET /api/cron/opsy-initiative-metrics
 *
 * Weekly (Mondays — lib/scheduled.ts CRON_TABLE). Opsy's governance /
 * initiative-quality behavior, surfaced through the ambient spine (charter:
 * "initiative-quality metrics for all agents · an agent trending
 * noisy/quiet/wrong → threshold-tuning proposal · graduation candidates after
 * ~100 clean instances → proposal to Garrett").
 *
 * Reads the per-(agent, action-type) metrics (graduation is per ACTION TYPE,
 * not per agent — shared charter rule), classifies them into graduation /
 * mis-targeted / noisy / quiet signals (lib/agent/opsy-governance.ts), and —
 * only when there's something worth surfacing — DMs Garrett a digest and logs
 * a LOW-tier Opsy intervention row. A quiet week logs nothing and posts
 * nothing (silent is first-class; Opsy is judged on acted-upon rate, not
 * activity).
 *
 * This is a scheduled STANDING report (one bounded digest per week), so it is
 * intentionally NOT gated by the notification budget — same exemption as
 * mo-friday-scorecard / pam-monday-digest.
 *
 * It only PROPOSES. Granting a standing permission means Garrett editing the
 * Garrett-only charter then `npm run sync:charters` — no code path here can
 * auto-grant autonomy, so there are no executable buttons, just the digest.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getActionTypeMetrics,
  getRecentInterventionCount,
  insertIntervention,
  setInterventionStatus,
} from "@/lib/supabase/agent-interventions";
import {
  classifyGovernance,
  renderGovernanceDigest,
  isGovernanceQuiet,
  ACTIVE_AMBIENT_AGENTS,
  QUIET_WINDOW_DAYS,
} from "@/lib/agent/opsy-governance";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const METRICS_WINDOW_DAYS = 30;
const GARRETT_EMAIL = "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const metrics = await getActionTypeMetrics(METRICS_WINDOW_DAYS);

  // Per-agent non-silent counts over the quiet window — only for the agents
  // expected to be firing (quiet detection).
  const recentByAgent: Record<string, number> = {};
  await Promise.all(
    ACTIVE_AMBIENT_AGENTS.map(async (a) => {
      recentByAgent[a] = await getRecentInterventionCount(a, QUIET_WINDOW_DAYS * 24);
    }),
  );

  const gov = classifyGovernance(metrics, recentByAgent);
  const summary = {
    actionTypesTracked: metrics.length,
    graduation: gov.graduation.length,
    wrong: gov.wrong.length,
    noisy: gov.noisy.length,
    quiet: gov.quiet.length,
  };

  // Nothing worth surfacing — stay silent (no row, no ping).
  if (isGovernanceQuiet(gov)) {
    return NextResponse.json({ ...summary, posted: false, logged: false });
  }

  const digest = renderGovernanceDigest(gov, metrics, METRICS_WINDOW_DAYS);

  const row = await insertIntervention({
    agent: "opsy",
    decision: "act_low",
    riskTier: "low",
    trigger: "weekly initiative-quality review surfaced a graduation/threshold signal",
    artifact: { title: "Opsy initiative-quality review", body: digest },
    rationale: "charter: initiative-quality metrics + graduation/threshold-tuning proposals to Garrett",
    targetHuman: GARRETT_EMAIL,
  });

  let posted = false;
  if (ambientDirectDmsAllowed()) {
    posted = await sendDmByEmail(GARRETT_EMAIL, digest);
  } else {
    posted = (
      await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${GARRETT_EMAIL}]\n${digest}`)
    ).posted;
  }
  if (row) await setInterventionStatus(row.id, "executed");

  return NextResponse.json({ ...summary, posted, logged: !!row });
}
