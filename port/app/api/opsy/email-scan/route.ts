/**
 * POST /api/opsy/email-scan — scan inboxes for infrastructure vendor
 * notifications, classify with Haiku, capture to opsy_email_captures, and
 * open incidents for actionable critical/warning alerts.
 *
 * Auth: CRON_SECRET (scheduler, every 15 min) or CMO_API_TOKEN (the
 * opsy_scan_emails MCP tool / on-demand).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { scanInfraEmails } from "@/lib/opsy/email-scan";

export const maxDuration = 300;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const result = await scanInfraEmails();
    return json(result);
  } catch (err) {
    console.error("[api/opsy/email-scan] POST failed:", err);
    return error("email scan failed", 500);
  }
}
