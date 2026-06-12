/**
 * Opsy email scan cron — every 15 minutes via the five-minute trigger's
 * minute slotting in lib/scheduled.ts. Thin wrapper over the scan engine
 * (same logic as POST /api/opsy/email-scan).
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

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const result = await scanInfraEmails();
    console.log(
      `[cron/opsy-email-scan] ${result.accounts_scanned.length} account(s), ${result.seen} seen, ${result.captured} captured, ${result.incidents_opened.length} incident(s)`,
    );
    return json(result);
  } catch (err) {
    console.error("[cron/opsy-email-scan] failed:", err);
    return error("email scan failed", 500);
  }
}
