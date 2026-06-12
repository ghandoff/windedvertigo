/**
 * Opsy tier-3 health check — external services (notion, resend; vercel/
 * github/stripe when credentialed). Runs every 30 minutes via the
 * five-minute trigger's minute slotting in lib/scheduled.ts.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { runHealthChecks } from "@/lib/opsy/health";

export const maxDuration = 60;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const result = await runHealthChecks("tier3");
    console.log(
      `[cron/opsy-health-check-t3] checked ${result.checked} (${result.skipped} skipped) | opened ${result.incidents_opened.length}, resolved ${result.incidents_resolved.length}`,
    );
    return json(result);
  } catch (err) {
    console.error("[cron/opsy-health-check-t3] failed:", err);
    return error("tier-3 health check failed", 500);
  }
}
