/**
 * GET /api/opsy/health — current health of all monitored services, rolled up
 * by platform for the zoom-out view (posture.md §4). Reads stored check
 * results; it does not probe. Trigger a fresh run via POST /api/opsy/check.
 *
 * Rollup logic lives in lib/opsy/rollup.ts (shared with the /ops dashboard).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { buildHealthRollup } from "@/lib/opsy/rollup";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const { platforms, services, last_check } = await buildHealthRollup();
    return json({ platforms, services, last_check });
  } catch (err) {
    console.error("[api/opsy/health] GET failed:", err);
    return error("failed to load health status", 500);
  }
}
