/**
 * GET /api/cron/milestone-reminders
 *
 * Hourly cron: finds rfp_milestones due within the next 24 hours that
 * haven't had a reminder sent yet, and DMs the owner via Slack.
 *
 * Pattern matches the other deadline-reminder crons (deadline-reminders,
 * submission-followup) — auth via CRON_SECRET bearer.
 *
 * Each milestone gets ONE reminder. After firing, reminder_sent_at is set
 * so subsequent cron runs skip it. Slipped milestones (past due_at and
 * still pending) become a separate concern handled by the dashboard /
 * weekly review, not this cron.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getMilestonesDueWithin,
  markReminderSent,
} from "@/lib/supabase/rfp-milestones";
import { sendDmByEmail } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  return (authHeader?.replace("Bearer ", "") ?? "") === process.env.CRON_SECRET;
}

function formatDue(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffH = Math.round((d.getTime() - now.getTime()) / 3600000);
  if (diffH < 1) return "less than 1 hour from now";
  if (diffH < 24) return `in ${diffH} hour${diffH === 1 ? "" : "s"}`;
  return d.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Los_Angeles",
    timeZoneName: "short",
  });
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const dueWithin24h = await getMilestonesDueWithin(24);
  if (dueWithin24h.length === 0) {
    return NextResponse.json({ ok: true, reminded: 0, milestones: 0 });
  }

  const baseUrl = process.env.CRM_BASE_URL ?? "https://port.windedvertigo.com";
  let reminded = 0;
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const m of dueWithin24h) {
    if (!m.ownerEmail) {
      skipped.push({ id: m.id, reason: "no owner_email" });
      // Still mark it sent so we don't keep checking — owner-less milestones
      // require manual assignment.
      await markReminderSent(m.id).catch(() => {});
      continue;
    }
    const text = [
      `⏰ *Milestone reminder:* ${m.label}`,
      `Due ${formatDue(m.dueAt)}.`,
      ``,
      `Open the RFP: ${baseUrl}/rfp-radar/${m.rfpId}`,
    ].join("\n");

    try {
      const sent = await sendDmByEmail(m.ownerEmail, text);
      if (sent) {
        await markReminderSent(m.id);
        reminded += 1;
      } else {
        skipped.push({ id: m.id, reason: `slack DM failed for ${m.ownerEmail}` });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      skipped.push({ id: m.id, reason: msg });
    }
  }

  console.warn(`[milestone-reminders] reminded ${reminded}, skipped ${skipped.length}`);
  return NextResponse.json({ ok: true, reminded, milestones: dueWithin24h.length, skipped });
}
