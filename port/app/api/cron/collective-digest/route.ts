/**
 * GET /api/cron/collective-digest
 *
 * The one daily touch: an 8am PT digest compiled from all six agents'
 * overnight logs (Mo/PaM/cARL/Opsy/Biz/Fin decisions + PaM's due/overdue
 * commitments), written by Claude in PaM's voice, posted to #daily-brief.
 *
 * Format is enforced in the prompt, not in code (same approach as
 * opsy-digest's tone/format): max 7 lines, wins first, then deadlines, then
 * at most one ask per human. This replaces reading five separate bot
 * channels with one well-shaped daily touch.
 *
 * Auth: Bearer CRON_SECRET (scheduler) or CMO_API_TOKEN (on-demand agent run).
 */

import { NextRequest, NextResponse } from "next/server";
import { callClaude } from "@/lib/ai/client";
import { postToChannelResilient } from "@/lib/slack";
import { getCmoDecisions } from "@/lib/supabase/cmo";
import { getPamDecisions, getPamCommitments } from "@/lib/supabase/pam";
import { getCarlFindings } from "@/lib/supabase/carl";
import { buildHealthRollup } from "@/lib/opsy/rollup";
import { getRecentAutoFixes, getRecentCronFailures } from "@/lib/supabase/opsy";
import { getRecentBizDecisions } from "@/lib/biz-data";
import { getRecentDecisions as getRecentFinDecisions } from "@/lib/fin-data";
import { getOpenLevel2Escalations } from "@/lib/escalation";

export const maxDuration = 60;

const CHANNEL = "#daily-brief";
const LEAD_EMAIL = "garrett@windedvertigo.com";
const OPEN_COMMITMENT_STATUSES = ["not-started", "in-progress", "blocked"];

function verifyAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  return (
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (!!process.env.CMO_API_TOKEN && token === process.env.CMO_API_TOKEN)
  );
}

const SYSTEM = `you are PaM, winded.vertigo's project manager, compiling the one daily digest for #daily-brief from all six agents' overnight activity (mo, pam, carl, opsy, biz, fin).

design principle: agents work at night, humans get one well-shaped touch a day. cap what you surface — this replaces reading five separate bot channels, so be genuinely selective, not exhaustive.

format, strictly:
- max 7 lines total
- if any "decisions needed" facts are given below, that's the very first line: "*decisions needed:*" followed by each one, terse — these are level-2 escalation-ladder markers (agents flagging something a human still has to decide), so they always lead, even before wins
- wins next (what shipped/got done/resolved)
- then deadlines (due today/this week, especially anything overdue)
- then at most ONE ask per human, only if something genuinely needs their attention — most days most people get zero asks
- lowercase per w.v brand, plain language, no corporate throat-clearing
- if a section has nothing to report, skip it entirely — don't pad

never guilt-trip, never use urgency language unless something is genuinely urgent (PaM's posture: contextual, human-sounding, never a compliance dashboard).

return plain text formatted for slack mrkdwn (*bold*, • bullets), no prose preamble, no json.`;

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const sinceIso = since.toISOString();
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const weekAhead = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [
      cmoDecisions,
      pamDecisions,
      carlFindingsRaw,
      rollup,
      autoFixes,
      cronFailures,
      bizDecisionsRaw,
      finDecisionsRaw,
      overdueCommitments,
      dueThisWeek,
      openLevel2Escalations,
    ] = await Promise.all([
      getCmoDecisions({ days: 1, limit: 20 }).catch(() => []),
      getPamDecisions({ days: 1, limit: 20 }).catch(() => []),
      getCarlFindings({ limit: 15 }).catch(() => []),
      buildHealthRollup().catch(() => null),
      getRecentAutoFixes(1).catch(() => []),
      getRecentCronFailures(1).catch(() => []),
      getRecentBizDecisions(20).catch(() => []),
      getRecentFinDecisions(20).catch(() => []),
      getPamCommitments({ due_before: today, limit: 50 }).catch(() => []),
      getPamCommitments({ due_before: weekAhead, due_after: tomorrow, limit: 50 }).catch(() => []),
      getOpenLevel2Escalations(sinceIso).catch(() => []),
    ]);

    // getCarlFindings/getRecentBizDecisions/getRecentFinDecisions have no
    // `days` param — filter to the last 24h client-side.
    const carlFindings = carlFindingsRaw.filter((f) => f.created_at >= sinceIso);
    const bizDecisions = bizDecisionsRaw.filter((d) => d.created_at >= sinceIso);
    const finDecisions = finDecisionsRaw.filter((d) => d.created_at >= sinceIso);
    const overdueOpen = overdueCommitments.filter((c) => OPEN_COMMITMENT_STATUSES.includes(c.status));
    const dueThisWeekOpen = dueThisWeek.filter((c) => OPEN_COMMITMENT_STATUSES.includes(c.status));

    const incidents24h = rollup?.incidents_7d.filter((i) => i.opened_at >= sinceIso) ?? [];

    const facts = [
      `decisions needed — ${openLevel2Escalations.length} open level-2 escalation(s) from the agents: ${openLevel2Escalations.slice(0, 8).map((e) => `[${e.agent}] ${e.message}`).join(" || ") || "none"}`,
      `mo — ${cmoDecisions.length} decision(s) logged: ${cmoDecisions.slice(0, 5).map((d) => d.summary).join(" || ") || "none"}`,
      `pam — ${pamDecisions.length} decision(s) logged: ${pamDecisions.slice(0, 5).map((d) => d.summary).join(" || ") || "none"}`,
      `carl — ${carlFindings.length} new finding(s): ${carlFindings.slice(0, 5).map((f) => f.title).join(" || ") || "none"}`,
      `opsy — health: ${rollup ? Object.entries(rollup.platforms).map(([k, p]) => `${k} ${p.status}`).join(", ") : "unknown"}; incidents last 24h: ${incidents24h.length} (${incidents24h.filter((i) => i.status === "resolved").length} resolved); auto-fixes: ${autoFixes.length}; cron failures: ${cronFailures.length}`,
      `biz — ${bizDecisions.length} decision(s) logged: ${bizDecisions.slice(0, 5).map((d) => d.decision).join(" || ") || "none"}`,
      `fin — ${finDecisions.length} decision(s) logged: ${finDecisions.slice(0, 5).map((d) => d.decision).join(" || ") || "none"}`,
      `pam commitments — overdue & still open: ${overdueOpen.length} (${overdueOpen.slice(0, 8).map((c) => `${c.who}: ${c.what}`).join(" || ") || "none"}); due in the next 7 days: ${dueThisWeekOpen.length} (${dueThisWeekOpen.slice(0, 8).map((c) => `${c.who}: ${c.what} (${c.due_date})`).join(" || ") || "none"})`,
    ].join("\n\n");

    const result = await callClaude({
      feature: "collective-digest",
      system: SYSTEM,
      userMessage: `last 24h across the collective:\n\n${facts}`,
      userId: "system-cron",
      maxTokens: 500,
      temperature: 0.3,
    });

    const message = `:sunrise: *daily brief*\n\n${result.text}`;
    const posted = await postToChannelResilient(CHANNEL, message, [LEAD_EMAIL]);
    if (!posted) console.warn("[cron/collective-digest] Slack post failed — digest was computed but never reached #daily-brief");

    return NextResponse.json({
      ok: true,
      posted,
      costUsd: result.costUsd,
      overdueCommitments: overdueOpen.length,
      dueThisWeek: dueThisWeekOpen.length,
      incidents24h: incidents24h.length,
      decisionsNeeded: openLevel2Escalations.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[cron/collective-digest] failed:", message);
    return NextResponse.json({ error: "digest_failed", message }, { status: 500 });
  }
}
