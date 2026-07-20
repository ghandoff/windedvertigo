/**
 * GET /api/cron/mo-friday-scorecard
 *
 * Fridays 16:00 UTC. Mo pilot behavior #4 (charter: "Number: marketing-
 * sourced weighted pipeline, reported Fridays"; "publish internal
 * digests/scorecards (LOW)"). Direct digest post, same pattern as
 * whirlpool-checkin — LOW tier, act-no-gate, still logs an
 * agent_interventions row for metrics consistency.
 *
 * Scope note: `deals.origin_type` is null on 9 of 10 live rows (only
 * "warm_outreach" is populated) — there's no reliable way today to isolate
 * "marketing-sourced" deals from the rest of the pipeline. Rather than
 * silently mislabel the whole open pipeline as marketing-sourced, this
 * reports total open-pipeline value + stage breakdown with that caveat
 * stated plainly. Tightening the number to true marketing-attribution is
 * follow-up work once deal-sourcing gets tagged consistently.
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase/client";
import { postToChannelResilientDetailed } from "@/lib/slack";
import { insertIntervention, setInterventionStatus } from "@/lib/supabase/agent-interventions";
import { ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("deals")
    .select("stage, value")
    .not("stage", "in", "(won,lost)");
  if (error) {
    console.warn("[cron/mo-friday-scorecard] deals query failed:", error.message);
    return NextResponse.json({ error: "query_failed" }, { status: 500 });
  }

  const rows = data ?? [];
  const total = rows.reduce((sum, r) => sum + (typeof r.value === "number" ? r.value : 0), 0);
  const byStage = new Map<string, { count: number; value: number }>();
  for (const r of rows) {
    const entry = byStage.get(r.stage) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += typeof r.value === "number" ? r.value : 0;
    byStage.set(r.stage, entry);
  }
  const stageLines = [...byStage.entries()]
    .map(([stage, { count, value }]) => `  • ${stage}: ${count} deal(s), $${value.toLocaleString("en-US")}`)
    .join("\n");

  const message =
    `*Mo — Friday pipeline scorecard*\n` +
    `open pipeline: $${total.toLocaleString("en-US")} across ${rows.length} deal(s)\n` +
    stageLines +
    `\n\n_caveat: marketing-source attribution isn't reliably tagged yet (origin_type is mostly unset) — this is total open pipeline, not isolated to marketing-sourced deals._`;

  const posted = await postToChannelResilientDetailed(ambientNotifyChannel(), message);

  const row = await insertIntervention({
    agent: "mo",
    decision: "act_low",
    riskTier: "low",
    trigger: "Friday pipeline scorecard (scheduled)",
    artifact: { title: "Friday pipeline scorecard", body: message },
    rationale: "charter: publish internal digests/scorecards (LOW), reported Fridays",
  });
  if (row) await setInterventionStatus(row.id, "executed");

  return NextResponse.json({ total, dealCount: rows.length, posted });
}
