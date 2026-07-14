/**
 * GET /api/cron/whirlpool-sweep
 *
 * Reads new #whirlpool messages since the last sweep, asks Claude to extract
 * commitment candidates ("who said they'd do what by when"), and logs them
 * as public pam_commitments (source: "whirlpool-sweep") — exactly what the
 * whirlpool agenda text has long asserted happens ("PaM sweeps this channel
 * after and logs the commitments") but nothing previously implemented.
 *
 * Posts a short confirmation digest back to #whirlpool so the sweep's output
 * is visible, not another silent background write.
 *
 * This is a Slack-history sweep, not a transcript-based one — PaM's posture
 * doc (docs/pam/posture.md) frames commitment-logging as happening off the
 * meeting transcript, which depends on the (separately gated) meeting-notes
 * pipe. Revisit as transcript-based once that pipe lands.
 *
 * Auth: Bearer CRON_SECRET (scheduler) or CMO_API_TOKEN (on-demand agent run).
 */

import { NextRequest, NextResponse } from "next/server";
import { readChannelHistory, getSlackUserName, postToChannelResilient } from "@/lib/slack";
import { insertPamCommitment, upsertPamMemory, getPamMemory } from "@/lib/supabase/pam";
import { callClaude, parseJsonResponse } from "@/lib/ai/client";
import { currentCycleMonday } from "@/lib/pam/cycle";

export const maxDuration = 60;

const CHANNEL = "#whirlpool";
const LAST_SWEPT_KEY = "whirlpool-sweep-last-ts";
const LEAD_EMAIL = "garrett@windedvertigo.com";
// First run (no stored watermark): don't try to sweep the channel's entire
// history — bound to the last 10 days so an unset watermark degrades to "the
// last week or so", not a giant one-off backfill.
const FIRST_RUN_LOOKBACK_DAYS = 10;

function verifyAuth(req: NextRequest): boolean {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return false;
  const token = header.slice(7);
  return (
    (!!process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (!!process.env.CMO_API_TOKEN && token === process.env.CMO_API_TOKEN)
  );
}

const SYSTEM = `you are PaM, winded.vertigo's project manager. you are given a transcript of recent #whirlpool Slack messages (speaker name + text). extract genuine commitments — "who said they'd do what by when" — that a teammate stated they will personally do. do NOT extract: questions, general discussion, things someone else is doing, or vague intentions ("we should really...").

if a rough deadline is mentioned (a day name, a date, "by friday", etc.) resolve it to an ISO date (YYYY-MM-DD) relative to the message context; otherwise omit it.

return ONLY json, no prose:
{ "commitments": [ { "who": "name as it appears in the transcript", "what": "the commitment, third-person, concise", "due_date": "YYYY-MM-DD or omit" } ] }
if there are no genuine commitments, return { "commitments": [] }.`;

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const memory = await getPamMemory().catch(() => []);
    const lastSweptTs = memory.find((m) => m.key === LAST_SWEPT_KEY)?.value;
    const oldest =
      lastSweptTs ??
      (Date.now() / 1000 - FIRST_RUN_LOOKBACK_DAYS * 86_400).toFixed(6);

    const messages = await readChannelHistory(CHANNEL, oldest);
    if (messages.length === 0) {
      return NextResponse.json({ ok: true, swept: 0, message: "no new #whirlpool messages" });
    }

    // Resolve unique speaker IDs → display names once, not per-message.
    const uniqueUserIds = [...new Set(messages.map((m) => m.user).filter((u): u is string => !!u))];
    const nameById = new Map<string, string>(
      await Promise.all(
        uniqueUserIds.map(async (id) => [id, await getSlackUserName(id).catch(() => id)] as const),
      ),
    );

    const transcript = messages
      .slice()
      .reverse() // Slack history returns newest-first; read chronologically
      .map((m) => `${nameById.get(m.user ?? "") ?? "someone"}: ${m.text}`)
      .join("\n");

    const res = await callClaude({
      feature: "whirlpool-sweep",
      userId: "whirlpool-sweep-cron",
      system: SYSTEM,
      userMessage: transcript,
      maxTokens: 800,
      temperature: 0.2,
    });

    const parsed = parseJsonResponse<{ commitments: { who: string; what: string; due_date?: string }[] }>(res.text);
    const candidates = parsed.commitments ?? [];

    const cycle = currentCycleMonday();
    let logged = 0;
    for (const c of candidates) {
      if (!c.who || !c.what) continue;
      await insertPamCommitment({
        who: c.who,
        what: c.what,
        due_date: c.due_date,
        source: "whirlpool-sweep",
        visibility: "public",
        cycle,
      }).then(() => { logged++; }).catch((err) => {
        console.warn("[cron/whirlpool-sweep] failed to log commitment:", err instanceof Error ? err.message : err);
      });
    }

    // Watermark: the newest message's ts (messages[0] before we reversed above).
    const newestTs = messages[0]?.ts;
    if (newestTs) await upsertPamMemory(LAST_SWEPT_KEY, newestTs, "whirlpool-sweep-cron").catch(() => {});

    const summary =
      logged > 0
        ? `*whirlpool sweep* — logged ${logged} commitment${logged !== 1 ? "s" : ""} from #whirlpool:\n${candidates.slice(0, logged).map((c) => `• ${c.who}: ${c.what}${c.due_date ? ` (due ${c.due_date})` : ""}`).join("\n")}`
        : `*whirlpool sweep* — read ${messages.length} message${messages.length !== 1 ? "s" : ""}, no new commitments found`;
    const posted = await postToChannelResilient(CHANNEL, summary, [LEAD_EMAIL]);
    if (!posted) console.warn("[cron/whirlpool-sweep] confirmation post failed");

    return NextResponse.json({ ok: true, messagesRead: messages.length, candidates: candidates.length, logged, posted });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error("[cron/whirlpool-sweep] failed:", message);
    return NextResponse.json({ error: "sweep_failed", message }, { status: 500 });
  }
}
