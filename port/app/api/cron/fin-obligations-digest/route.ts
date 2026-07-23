/**
 * GET /api/cron/fin-obligations-digest
 *
 * Weekly (Mondays — lib/scheduled.ts CRON_TABLE). Fin's first spine-integrated
 * ambient behavior (charter: "invoice hygiene · Watches: contracts, invoices,
 * ... milestone dates"). The fin-email-scan / fin-box-scan crons already
 * INGEST bills/invoices/tax notices into `fin_items`, but nothing surfaces
 * the overdue/imminent ones — so they just sit there (11 overdue at build
 * time, nobody told). This closes that loop: a single obligations digest to
 * Garrett, only when there's something to say.
 *
 * A DIGEST, not per-item cards, on purpose: Fin can't *execute* anything (it
 * can't pay a bill), so an approve/ignore card has no action behind it, and N
 * overdue items would be N cards that instantly blow the 3/agent/day budget.
 * One consolidated LOW-tier row — the same standing-report shape as Opsy's
 * governance digest and pam-monday-digest, and likewise budget-exempt.
 *
 * NOT the charter's "margin per engagement (40% floor)" behavior — that needs
 * per-engagement revenue/cost data the fin_* schema doesn't hold yet (a data
 * prerequisite, tracked in the status doc), so it's deliberately out of scope
 * here.
 */

import { NextRequest, NextResponse } from "next/server";
import { getOpenFinItems, getUpcomingFinItems, type FinItem } from "@/lib/fin-data";
import { insertIntervention, setInterventionStatus } from "@/lib/supabase/agent-interventions";
import { sendDmByEmail, postToChannelResilientDetailed } from "@/lib/slack";
import { ambientDirectDmsAllowed, ambientNotifyChannel } from "@/lib/agent/ambient-rollout";

const DUE_SOON_DAYS = 14;
// Only surface items that went overdue recently. Older-than-this pending items
// are stale ingested rows (e.g. a 2024 tax form never marked actioned), not
// live obligations — nagging about them weekly is noise, not hygiene. They want
// a one-time cleanup in /finn, not a recurring alert. Tunable.
const OVERDUE_LOOKBACK_DAYS = 60;
const GARRETT_EMAIL = "garrett@windedvertigo.com";

function verifyCronAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CRON_SECRET;
}

function money(item: FinItem): string {
  if (item.amount_cents == null) return "—";
  return `${item.currency === "USD" ? "$" : `${item.currency} `}${(item.amount_cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / (24 * 60 * 60 * 1000));
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);
  const overdueFloor = new Date(Date.now() - OVERDUE_LOOKBACK_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const [open, dueSoon] = await Promise.all([getOpenFinItems(), getUpcomingFinItems(DUE_SOON_DAYS)]);

  // Overdue = open + due date in [today - OVERDUE_LOOKBACK_DAYS, today). The
  // lower bound drops stale pre-window rows. dueSoon already excludes overdue
  // (its query is due_date >= today), so the two don't overlap.
  const overdue = open
    .filter((i) => i.due_date && i.due_date < today && i.due_date >= overdueFloor)
    .sort((a, b) => (a.due_date! < b.due_date! ? -1 : 1));

  // Nothing to say — stay silent (no row, no ping).
  if (overdue.length === 0 && dueSoon.length === 0) {
    return NextResponse.json({ overdue: 0, dueSoon: 0, posted: false, logged: false });
  }

  const line = (i: FinItem, tail: string) =>
    `  • ${i.title}${i.source ? ` (${i.source})` : ""} — ${money(i)}${tail}`;

  const parts: string[] = ["*💷 Fin — financial obligations check*"];
  if (overdue.length) {
    parts.push(`\n*overdue (${overdue.length})*`);
    for (const i of overdue) {
      parts.push(line(i, i.due_date ? ` · due ${i.due_date} (${daysBetween(i.due_date, today)}d late)` : ""));
    }
  }
  if (dueSoon.length) {
    parts.push(`\n*due in the next ${DUE_SOON_DAYS} days (${dueSoon.length})*`);
    for (const i of dueSoon) {
      parts.push(line(i, i.due_date ? ` · due ${i.due_date}` : ""));
    }
  }
  parts.push(`\n_full list + actions at port.windedvertigo.com/finn · trigger: weekly obligations sweep of fin_items_`);
  const digest = parts.join("\n");

  const row = await insertIntervention({
    agent: "fin",
    decision: "act_low",
    riskTier: "low",
    trigger: `weekly obligations check — ${overdue.length} overdue, ${dueSoon.length} due within ${DUE_SOON_DAYS} days`,
    artifact: { title: "Fin obligations check", body: digest },
    rationale: "charter: invoice hygiene — surface overdue/imminent financial obligations so nothing slips",
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

  return NextResponse.json({ overdue: overdue.length, dueSoon: dueSoon.length, posted, logged: !!row });
}
