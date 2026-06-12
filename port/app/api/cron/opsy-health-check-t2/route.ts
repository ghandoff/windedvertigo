/**
 * Opsy tier-2 health check — data layer (supabase, R2, neon when credentialed).
 * Runs every 15 minutes via the five-minute trigger's minute slotting in
 * lib/scheduled.ts. Same wrapper pattern as opsy-health-check-t1.
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
    const result = await runHealthChecks("tier2");
    console.log(
      `[cron/opsy-health-check-t2] checked ${result.checked} (${result.skipped} skipped) | opened ${result.incidents_opened.length}, resolved ${result.incidents_resolved.length}`,
    );
    return json(result);
  } catch (err) {
    console.error("[cron/opsy-health-check-t2] failed:", err);
    return error("tier-2 health check failed", 500);
  }
}
