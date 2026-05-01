/**
 * GET /api/cron/deadline-reminders
 *
 * Vercel cron job — runs daily.
 * Posts a Slack message for RFP opportunities with deadlines
 * at exactly 60, 30, 7, or 1 day out.
 */

import { NextRequest, NextResponse } from "next/server";
import { queryRfpOpportunities } from "@/lib/notion/rfp-radar";
import { postToSlack } from "@/lib/slack";
import type { RfpOpportunity } from "@/lib/notion/types";

const TERMINAL_STATUSES: RfpOpportunity["status"][] = ["won", "lost", "no-go", "missed deadline"];
const REMINDER_DAYS = new Set([60, 30, 7, 1]);

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
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const { data: all } = await queryRfpOpportunities(undefined, { pageSize: 100 });

    const reminders: Array<{ rfp: RfpOpportunity; days: number }> = [];

    for (const rfp of all) {
      if (!rfp.dueDate?.start) continue;
      if (TERMINAL_STATUSES.includes(rfp.status)) continue;

      const days = daysUntil(rfp.dueDate.start);
      if (REMINDER_DAYS.has(days)) {
        reminders.push({ rfp, days });
      }
    }

    if (reminders.length === 0) {
      return NextResponse.json({ message: "no deadlines today" });
    }

    // Sort by days ascending (soonest first)
    reminders.sort((a, b) => a.days - b.days);

    const lines = reminders.map(({ rfp, days }) => {
      const dateLabel = formatDate(rfp.dueDate!.start);
      return `• ${rfp.opportunityName} — due in ${days} day${days !== 1 ? "s" : ""} (${dateLabel})`;
    });

    const message = `*📅 RFP Deadline Reminders*\n\n${lines.join("\n")}`;

    await postToSlack(message);

    return NextResponse.json({
      message: `sent ${reminders.length} reminder${reminders.length !== 1 ? "s" : ""}`,
      reminders: reminders.map(({ rfp, days }) => ({ name: rfp.opportunityName, days })),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "cron failed";
    console.error("[cron/deadline-reminders]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
