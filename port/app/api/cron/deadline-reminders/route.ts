/**
 * GET /api/cron/deadline-reminders
 *
 * Daily cron (CRON_TABLE hours:[12]). Posts an RFP deadline reminder at exactly
 * 60, 30, 7, 3, or 1 day out — to the team channel AND as a Biz DM to the
 * reviewers (Garrett + Maria).
 *
 * Timezone-aware: when a funder timezone is known, the reminder translates the
 * deadline into Pacific time so the real cutoff is obvious — no more scrambling
 * for a 07:00-PT submission that's end-of-day in East Africa. The exact-day
 * match + once-daily run is the dedup (no per-reminder state needed).
 */

import { NextRequest, NextResponse } from "next/server";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import { postToSlack, sendDmByEmail } from "@/lib/slack";
import type { RfpOpportunity } from "@/lib/notion/types";

const TERMINAL_STATUSES: RfpOpportunity["status"][] = ["won", "lost", "no-go", "missed deadline"];
const REMINDER_DAYS = new Set([60, 30, 7, 3, 1]);
const PT_TZ = "America/Los_Angeles";
// assumed local submission cutoff when the TOR only gives a date (tenders are
// typically end-of-business). Labelled as an assumption in the message.
const ASSUMED_CUTOFF_HOUR = 17;

const REVIEWERS = (process.env.BIZ_REVIEW_EMAILS ?? "garrett@windedvertigo.com,maria@windedvertigo.com")
  .split(",").map((e) => e.trim()).filter(Boolean);

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

/** Days between today (midnight) and a date string. */
function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dateStr);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Offset (ms) of an IANA timezone at a given instant. */
function tzOffsetMs(tz: string, date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p: Record<string, string> = {};
  for (const part of dtf.formatToParts(date)) p[part.type] = part.value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - date.getTime();
}

/** The UTC instant for a wall-clock time in a given timezone. */
function zonedWallTimeToUtc(dateStr: string, hour: number, tz: string): Date {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const guessUtc = Date.UTC(y, mo - 1, d, hour, 0, 0);
  const offset = tzOffsetMs(tz, new Date(guessUtc));
  return new Date(guessUtc - offset);
}

function fmtClock(date: Date, tz: string): string {
  return date.toLocaleString("en-US", {
    timeZone: tz, month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    hour12: false, timeZoneName: "short",
  });
}

/**
 * Build the deadline line. When a funder timezone is known, translate the
 * assumed end-of-day cutoff into Pacific so the real local time is explicit.
 */
function deadlineLine(rfp: RfpOpportunity, days: number): string {
  const dateStr = rfp.dueDate!.start;
  const tz = rfp.deadlineTimezone;
  const base = `*${rfp.opportunityName}* — due in ${days} day${days !== 1 ? "s" : ""}`;
  if (!tz) {
    return `• ${base} (${formatDate(dateStr)}) · _funder timezone not set — confirm the cutoff_`;
  }
  try {
    const instant = zonedWallTimeToUtc(dateStr, ASSUMED_CUTOFF_HOUR, tz);
    const funder = fmtClock(instant, tz);
    const pacific = fmtClock(instant, PT_TZ);
    return `• ${base}\n    ↳ ~${funder} (assumed end-of-day) = *${pacific}* your time — confirm exact cutoff`;
  } catch {
    return `• ${base} (${formatDate(dateStr)}) · timezone: ${tz}`;
  }
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { data: all } = await getRfpOpportunitiesFromSupabase({}, { pageSize: 500 });

    const reminders: Array<{ rfp: RfpOpportunity; days: number }> = [];
    for (const rfp of all) {
      if (!rfp.dueDate?.start) continue;
      if (TERMINAL_STATUSES.includes(rfp.status)) continue;
      const days = daysUntil(rfp.dueDate.start);
      if (REMINDER_DAYS.has(days)) reminders.push({ rfp, days });
    }

    if (reminders.length === 0) {
      return NextResponse.json({ message: "no deadlines today" });
    }

    reminders.sort((a, b) => a.days - b.days);
    const lines = reminders.map(({ rfp, days }) => deadlineLine(rfp, days));
    const urgent = reminders.some((r) => r.days <= 3);
    const message = `📅 *Biz — RFP deadline reminders*${urgent ? " ⏰" : ""}\n\n${lines.join("\n")}`;

    // team channel (visibility) + DM the reviewers (the personal nudge)
    await postToSlack(message);
    const dmResults = await Promise.all(
      REVIEWERS.map((email) => sendDmByEmail(email, message).catch(() => false)),
    );

    return NextResponse.json({
      message: `sent ${reminders.length} reminder${reminders.length !== 1 ? "s" : ""}`,
      dmd: REVIEWERS.filter((_, i) => dmResults[i]),
      reminders: reminders.map(({ rfp, days }) => ({ name: rfp.opportunityName, days, tz: rfp.deadlineTimezone })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "cron failed";
    console.error("[cron/deadline-reminders]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
