/**
 * GET /api/cron/morning-digest
 *
 * Sends a personalized morning Slack DM to each active team member.
 * Includes:
 *   - Their workload pulse (utilization, open tasks, deadlines)
 *   - Collective context (who has bandwidth, who's stretched)
 *   - Action items: draft timesheets, overdue tasks, blocking items
 *
 * Runs weekday mornings. Each member receives their DM at a time
 * aligned to their time zone (handled by separate schedule entries
 * or a single run at ~9 AM UTC which covers most zones).
 *
 * Requires env vars:
 *   CRON_SECRET, SLACK_BOT_TOKEN
 */

import { NextRequest, NextResponse } from "next/server";
import { getActiveMembers, CAPACITY_HOURS } from "@/lib/notion/members";
import { queryTimesheets } from "@/lib/notion/timesheets";
import { queryWorkItems } from "@/lib/notion/work-items";
import { getNotionUserMap } from "@/lib/role";
import { computePulse, type MemberPulse } from "@/app/(dashboard)/work/collective-pulse";
import { sendDmByEmail } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return false;
  return authHeader.replace("Bearer ", "") === process.env.CRON_SECRET;
}

// ── Formatting helpers ─────────────────────────────────

function signalEmoji(signal: MemberPulse["signal"]): string {
  return {
    light: "🟦",
    balanced: "🟩",
    heavy: "🟨",
    overloaded: "🟥",
  }[signal];
}

function formatPulseForSelf(p: MemberPulse): string {
  const lines: string[] = [];
  const firstName = p.member.name.split(" ")[0].toLowerCase();

  lines.push(`${signalEmoji(p.signal)} *your pulse: ${p.signal === "overloaded" ? "overloaded — consider asking for help" : p.signal}*`);
  lines.push("");

  // Hours
  lines.push(`⏱️ *${p.hoursThisWeek.toFixed(1)}h* logged this week (${(p.utilization * 100).toFixed(0)}% of ${p.expectedHours}h capacity)`);

  // Open tasks
  if (p.openTasks > 0) {
    let taskLine = `📋 *${p.openTasks}* open tasks`;
    if (p.pressureTasks > 0) taskLine += ` — ${p.pressureTasks} urgent/high`;
    lines.push(taskLine);
  }

  // Upcoming deadlines
  if (p.upcomingDeadlines > 0) {
    lines.push(`📅 *${p.upcomingDeadlines}* due this week`);
  }

  // Blocking
  if (p.blockingCount > 0) {
    lines.push(`🚫 you're *blocking ${p.blockingCount}* tasks for others — worth prioritizing`);
  }

  return lines.join("\n");
}

function formatCollectiveContext(pulses: MemberPulse[], selfEmail: string): string {
  const others = pulses.filter((p) => p.member.email.toLowerCase() !== selfEmail.toLowerCase());
  if (others.length === 0) return "";

  const lines: string[] = ["", "*collective:*"];

  // Who has bandwidth
  const light = others.filter((p) => p.signal === "light");
  if (light.length > 0) {
    const names = light.map((p) => p.member.name.split(" ")[0].toLowerCase()).join(", ");
    lines.push(`🟦 _${names}_ — has bandwidth`);
  }

  // Who's stretched
  const heavy = others.filter((p) => p.signal === "heavy" || p.signal === "overloaded");
  if (heavy.length > 0) {
    for (const h of heavy) {
      const name = h.member.name.split(" ")[0].toLowerCase();
      const emoji = h.signal === "overloaded" ? "🟥" : "🟨";
      lines.push(`${emoji} _${name}_ — ${h.signal} (${h.openTasks} tasks, ${h.hoursThisWeek.toFixed(1)}h logged)`);
    }
  }

  return lines.join("\n");
}

function formatActionItems(
  p: MemberPulse,
  draftTimesheets: number,
  overdueItems: { task: string }[],
): string {
  const items: string[] = [];

  if (draftTimesheets > 0) {
    items.push(`• ${draftTimesheets} draft timesheet${draftTimesheets > 1 ? "s" : ""} to review → <https://port.windedvertigo.com/work/time|open timesheets>`);
  }

  if (overdueItems.length > 0) {
    const names = overdueItems.slice(0, 3).map((wi) => `_${wi.task}_`).join(", ");
    const extra = overdueItems.length > 3 ? ` +${overdueItems.length - 3} more` : "";
    items.push(`• overdue: ${names}${extra}`);
  }

  if (p.blockingCount > 0) {
    items.push(`• unblock ${p.blockingCount} task${p.blockingCount > 1 ? "s" : ""} others are waiting on`);
  }

  if (items.length === 0) return "";

  return "\n\n*to-do today:*\n" + items.join("\n");
}

// ── Main ───────────────────────────────────────────────

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!process.env.SLACK_BOT_TOKEN) {
    return NextResponse.json({ error: "SLACK_BOT_TOKEN not configured" }, { status: 500 });
  }

  // Fetch all data in parallel
  const twoWeeksAgo = new Date();
  twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
  const twoWeeksAgoStr = twoWeeksAgo.toISOString().split("T")[0];

  const today = new Date().toISOString().split("T")[0];

  const [members, notionUserMap, { data: timesheets }, { data: workItems }] = await Promise.all([
    getActiveMembers(),
    getNotionUserMap(),
    queryTimesheets({ dateAfter: twoWeeksAgoStr }, { pageSize: 500 }),
    queryWorkItems({ archive: false }, { pageSize: 500 }),
  ]);

  // Compute pulses
  const pulses = computePulse(members, notionUserMap, timesheets, workItems);

  // Send personalized DMs
  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const pulse of pulses) {
    const email = pulse.member.email;
    const userId = pulse.notionUserId;

    // Count draft timesheets for this person
    const draftCount = timesheets.filter(
      (ts) => ts.personIds.includes(userId) && ts.status === "draft",
    ).length;

    // Overdue tasks for this person
    const myOverdue = workItems.filter((wi) => {
      const isAssigned = wi.ownerIds.includes(userId) || wi.personIds.includes(userId);
      const isActive = !["complete", "cancelled"].includes(wi.status);
      const isOverdue = wi.dueDate?.start && wi.dueDate.start < today;
      return isAssigned && isActive && isOverdue;
    });

    // Build the message
    const selfSection = formatPulseForSelf(pulse);
    const collectiveSection = formatCollectiveContext(pulses, email);
    const actionSection = formatActionItems(pulse, draftCount, myOverdue);

    const greeting = getGreeting();
    const firstName = pulse.member.name.split(" ")[0].toLowerCase();

    const fullMessage = [
      `${greeting}, ${firstName} ☀️`,
      "",
      selfSection,
      collectiveSection,
      actionSection,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const ok = await sendDmByEmail(email, fullMessage);
      if (ok) {
        sent++;
      } else {
        skipped++;
      }
    } catch (err) {
      errors.push(`${email}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({
    message: `morning digest sent to ${sent} members`,
    sent,
    skipped,
    errors: errors.length > 0 ? errors : undefined,
    totalMembers: pulses.length,
  });
}

function getGreeting(): string {
  const hour = new Date().getUTCHours();
  // Loosely assume the person is seeing this around their morning
  if (hour < 12) return "good morning";
  if (hour < 17) return "good afternoon";
  return "good evening";
}
