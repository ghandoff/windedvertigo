/**
 * Opsy tier-1 health check — core platform (wv-site, harbour, nordic, port,
 * creaseworks). Runs every 5 minutes on the worker's existing five-minute
 * cron trigger (lib/scheduled.ts FIVE_MINUTE_PATHS), per posture.md tier 1.
 *
 * Calls the check engine directly rather than self-POSTing /api/opsy/check —
 * same logic, one less hop. Triggerable by the scheduler (CRON_SECRET) or an
 * agent/admin (CMO_API_TOKEN).
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
    const result = await runHealthChecks("tier1");
    const summary = result.results.map((r) => `${r.service}:${r.status}`).join(" ");
    console.log(
      `[cron/opsy-health-check-t1] ${summary} | opened ${result.incidents_opened.length}, resolved ${result.incidents_resolved.length}`,
    );
    return json(result);
  } catch (err) {
    console.error("[cron/opsy-health-check-t1] failed:", err);
    return error("tier-1 health check failed", 500);
  }
}
