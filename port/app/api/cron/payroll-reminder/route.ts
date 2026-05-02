/**
 * GET /api/cron/payroll-reminder
 *
 * Monthly reminder: fires on the 26th of each month at 9am UTC.
 * Sends Garrett a Slack DM prompting him to approve Payton's timesheets
 * and submit payroll before the ~4th of next month (Gusto's deadline).
 *
 * No Gusto OAuth needed — pure date-math + Slack bot DM.
 * Cron schedule: 0 9 26 * *  (vercel.json + lib/scheduled.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import { sendDm } from "@/lib/slack";

function verifyCronAuth(req: NextRequest): boolean {
  const authHeader = req.headers.get("authorization");
  return (authHeader?.replace("Bearer ", "") ?? "") === process.env.CRON_SECRET;
}

export async function GET(req: NextRequest) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // Display month in Pacific time — that's where Garrett is
  const month = now.toLocaleString("en-US", {
    month: "long",
    timeZone: "America/Los_Angeles",
  });
  const year = now.toLocaleString("en-US", {
    year: "numeric",
    timeZone: "America/Los_Angeles",
  });

  const text = [
    `*Payroll reminder — ${month} ${year}*`,
    `Payton's timesheet approval window closes soon. Please action before the 4th:`,
    `1. Approve timesheets → https://app.gusto.com/fly/time_tracking/list`,
    `2. Submit payroll → https://app.gusto.com/fly/payroll`,
  ].join("\n");

  console.log(`[payroll-reminder] sending DM for ${month} ${year}`);

  const slackUserId = process.env.GARRETT_SLACK_USER_ID;
  if (!slackUserId) {
    console.error("[payroll-reminder] GARRETT_SLACK_USER_ID not set");
    return NextResponse.json({ sent: false, month, year, error: "GARRETT_SLACK_USER_ID not configured" }, { status: 500 });
  }

  let sent = false;
  try {
    sent = await sendDm(slackUserId, text);
    if (sent) {
      console.log(`[payroll-reminder] DM sent ✓ (${month} ${year})`);
    } else {
      console.warn("[payroll-reminder] sendDm returned false — check SLACK_BOT_TOKEN scopes");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[payroll-reminder] DM send threw: ${message}`);
    return NextResponse.json({ sent: false, month, year, error: message }, { status: 500 });
  }

  return NextResponse.json({ sent, month, year });
}
