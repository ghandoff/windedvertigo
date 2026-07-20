/**
 * GET /api/cron/pam-monday-digest
 *
 * Mondays 14:00 UTC. PaM pilot behavior #3 (charter: "Number: commitment
 * slip rate + capacity coverage, reported Mondays"). Deliberately distinct
 * from the existing `whirlpool-checkin` cron (Fri 17:00 UTC): that one posts
 * a PUBLIC mid-cycle #whirlpool digest grouped by owner; this one DMs each
 * person their own open commitments privately at cycle START, plus an
 * exceptions-only (blocked items) note to Garrett. Two different audiences
 * and moments in the cycle — not a duplicate.
 *
 * `pam_commitments.who` is a lowercase first name derived from
 * `email.split("@")[0]` at creation time (see lib/pam/promote-commitment.ts's
 * resolveWho) — reconstructing `${who}@windedvertigo.com` correctly recovers
 * the original email for the whole collective (single-domain org, confirmed
 * via TEAM.md/CLAUDE.md). Breaks only for a `who` that was never derived
 * from a real email (e.g. "unassigned") — those are skipped, not guessed at.
 */

import { NextRequest, NextResponse } from "next/server";
import { getPamCommitments } from "@/lib/supabase/pam";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { insertIntervention, setInterventionStatus } from "@/lib/supabase/agent-interventions";
import { ambientNotifyChannel, ambientDirectDmsAllowed } from "@/lib/agent/ambient-rollout";

const OPEN_STATUSES = new Set(["not-started", "in-progress", "blocked"]);
const GARRETT_EMAIL = "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

function whoToEmail(who: string): string | null {
  if (!who || who === "unassigned") return null;
  return `${who}@windedvertigo.com`;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const all = await getPamCommitments({ limit: 200 });
  const open = all.filter((c) => OPEN_STATUSES.has(c.status));

  const byWho = new Map<string, typeof open>();
  for (const c of open) {
    if (!byWho.has(c.who)) byWho.set(c.who, []);
    byWho.get(c.who)!.push(c);
  }

  const dmsAllowed = ambientDirectDmsAllowed();
  let dmed = 0;
  for (const [who, items] of byWho) {
    const email = whoToEmail(who);
    if (!email) continue;
    const lines = items
      .map((c) => `  • ${c.what}${c.due_date ? ` (due ${c.due_date})` : ""}${c.status === "blocked" ? " 🚧 blocked" : ""}`)
      .join("\n");
    const text = `*your open commitments this week*\n${lines}\n\n_full board at port.windedvertigo.com/pam_`;
    if (dmsAllowed) {
      if (await sendDmByEmail(email, text)) dmed += 1;
    } else {
      await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${email}]\n${text}`);
      dmed += 1;
    }
  }

  const blocked = open.filter((c) => c.status === "blocked");
  const exceptionsNote = blocked.length
    ? `*PaM — exceptions (blocked commitments)*\n${blocked.map((c) => `• ${c.who}: ${c.what}${c.blocker ? ` — ${c.blocker}` : ""}`).join("\n")}`
    : null;
  if (exceptionsNote) {
    if (dmsAllowed) {
      await sendDmByEmail(GARRETT_EMAIL, exceptionsNote);
    } else {
      await postToChannelResilientDetailed(ambientNotifyChannel(), `[sandbox — would DM ${GARRETT_EMAIL}]\n${exceptionsNote}`);
    }
  }

  const row = await insertIntervention({
    agent: "pam",
    decision: "act_low",
    riskTier: "low",
    trigger: "Monday per-person commitment DM + exceptions note (scheduled)",
    artifact: { title: "Monday commitment DMs", body: `${dmed} DM(s) sent, ${blocked.length} exception(s)` },
    rationale: "charter: commitment slip rate + capacity coverage, reported Mondays",
  });
  if (row) await setInterventionStatus(row.id, "executed");

  return NextResponse.json({ peopleDmed: dmed, blockedExceptions: blocked.length });
}
