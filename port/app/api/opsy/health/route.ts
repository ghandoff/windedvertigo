/**
 * GET /api/opsy/health — current health of all monitored services, rolled up
 * by platform for the zoom-out view (posture.md §4). Reads stored check
 * results; it does not probe. Trigger a fresh run via POST /api/opsy/check.
 *
 * Rollup windows: status = latest check; uptime + p95 over 24h of checks;
 * incident counts over 7 days.
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import {
  getLatestHealthChecks,
  getHealthHistory,
  getOpsyIncidents,
  type OpsyHealthCheck,
} from "@/lib/supabase/opsy";
import { SERVICES, type Platform } from "@/lib/opsy/services";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

type Light = "green" | "amber" | "red" | "unknown";

const WORST: Record<Light, number> = { green: 0, unknown: 1, amber: 2, red: 3 };

function worstOf(statuses: Light[]): Light {
  return statuses.reduce<Light>((acc, s) => (WORST[s] > WORST[acc] ? s : acc), "green");
}

function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [latest, history, incidents] = await Promise.all([
      getLatestHealthChecks(),
      getHealthHistory(24),
      getOpsyIncidents({ since: sevenDaysAgo, limit: 200 }),
    ]);

    const latestByService = new Map<string, OpsyHealthCheck>(latest.map((c) => [c.service, c]));

    const services: Record<string, unknown> = {};
    for (const svc of SERVICES) {
      const current = latestByService.get(svc.id);
      const checks = history.filter((h) => h.service === svc.id);
      const up = checks.filter((h) => h.status !== "red").length;
      services[svc.id] = {
        name: svc.name,
        platform: svc.platform,
        tier: svc.tier,
        status: (current?.status ?? "unknown") as Light,
        response_time_ms: current?.response_time_ms ?? null,
        uptime_24h: checks.length ? Number(((up / checks.length) * 100).toFixed(2)) : null,
        p95_ms_24h: p95(checks.map((h) => h.response_time_ms ?? 0).filter((v) => v > 0)),
        incidents_7d: incidents.filter((i) => i.service === svc.id).length,
        last_check: current?.checked_at ?? null,
      };
    }

    const platforms: Record<string, unknown> = {};
    const platformIds = [...new Set(SERVICES.map((s) => s.platform))] as Platform[];
    for (const platform of platformIds) {
      const members = SERVICES.filter((s) => s.platform === platform);
      const memberIds = new Set(members.map((m) => m.id));
      const memberChecks = history.filter((h) => memberIds.has(h.service));
      const up = memberChecks.filter((h) => h.status !== "red").length;
      platforms[platform] = {
        status: worstOf(members.map((m) => (latestByService.get(m.id)?.status ?? "unknown") as Light)),
        uptime_24h: memberChecks.length ? Number(((up / memberChecks.length) * 100).toFixed(2)) : null,
        p95_ms_24h: p95(memberChecks.map((h) => h.response_time_ms ?? 0).filter((v) => v > 0)),
        incidents_7d: incidents.filter((i) => memberIds.has(i.service)).length,
        services: members.map((m) => m.id),
      };
    }

    const lastCheck = latest
      .map((c) => c.checked_at)
      .sort()
      .at(-1) ?? null;

    return json({ platforms, services, last_check: lastCheck });
  } catch (err) {
    console.error("[api/opsy/health] GET failed:", err);
    return error("failed to load health status", 500);
  }
}
