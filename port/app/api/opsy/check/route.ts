/**
 * POST /api/opsy/check — run an on-demand health check.
 *
 * Body: { scope: "all" | "tier1" | <service id> } (default "tier1").
 * Phase 1 implements tier 1 only — tier2-4 scopes resolve to no services and
 * return a clear message rather than an error, so phase-2 crons can be wired
 * up before their checks exist.
 *
 * Auth: CRON_SECRET (scheduler) or CMO_API_TOKEN (agents / on-demand), same
 * dual-token pattern as /api/cron/carl-study.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { runHealthChecks } from "@/lib/opsy/health";
import { servicesForScope } from "@/lib/opsy/services";

export const maxDuration = 60;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

export async function POST(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  const body = await req.json().catch(() => ({}));
  const scope = typeof body?.scope === "string" ? body.scope : "tier1";

  if (servicesForScope(scope).length === 0) {
    return json({
      scope,
      checked: 0,
      message: `no services registered for scope '${scope}' — phase 1 covers tier1 only`,
    });
  }

  try {
    const result = await runHealthChecks(scope);
    return json(result);
  } catch (err) {
    console.error("[api/opsy/check] POST failed:", err);
    return error("health check run failed", 500);
  }
}
