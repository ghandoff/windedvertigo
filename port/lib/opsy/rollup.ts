/**
 * Health rollups shared by GET /api/opsy/health and the /ops dashboard page.
 * Reads stored check results only — never probes.
 */

import { supabase } from "@/lib/supabase/client";
import {
  getHealthHistory,
  getLatestHealthChecks,
  getOpsyIncidents,
  type OpsyHealthCheck,
  type OpsyIncident,
} from "@/lib/supabase/opsy";
import { SERVICES, type Platform } from "./services";

export type Light = "green" | "amber" | "red" | "unknown";

const WORST: Record<Light, number> = { green: 0, unknown: 1, amber: 2, red: 3 };

export function worstOf(statuses: Light[]): Light {
  return statuses.reduce<Light>((acc, s) => (WORST[s] > WORST[acc] ? s : acc), "green");
}

export function p95(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

export interface ServiceRollup {
  name: string;
  platform: Platform;
  tier: number;
  status: Light;
  response_time_ms: number | null;
  uptime_24h: number | null;
  p95_ms_24h: number | null;
  incidents_7d: number;
  last_check: string | null;
}

export interface PlatformRollup {
  status: Light;
  uptime_24h: number | null;
  p95_ms_24h: number | null;
  incidents_7d: number;
  services: string[];
}

export interface HealthRollup {
  platforms: Record<string, PlatformRollup>;
  services: Record<string, ServiceRollup>;
  /** raw incidents fetched for the 7d window (reused by the dashboard) */
  incidents_7d: OpsyIncident[];
  last_check: string | null;
}

export async function buildHealthRollup(): Promise<HealthRollup> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [latest, history, incidents] = await Promise.all([
    getLatestHealthChecks(),
    getHealthHistory(24),
    getOpsyIncidents({ since: sevenDaysAgo, limit: 200 }),
  ]);

  const latestByService = new Map<string, OpsyHealthCheck>(latest.map((c) => [c.service, c]));

  const services: Record<string, ServiceRollup> = {};
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

  const platforms: Record<string, PlatformRollup> = {};
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

  const last_check = latest.map((c) => c.checked_at).sort().at(-1) ?? null;

  return { platforms, services, incidents_7d: incidents, last_check };
}

export interface HourlyBucket {
  service: string;
  bucket: string;
  p95_ms: number | null;
  worst: "green" | "amber" | "red";
}

/**
 * Hourly p95 + worst-status buckets per service (SQL-aggregated via the
 * opsy_hourly_health function — ~168 rows/service for 7 days instead of
 * thousands of raw checks).
 */
export async function getSparklineSeries(hoursBack = 168): Promise<Map<string, HourlyBucket[]>> {
  const { data, error } = await supabase.rpc("opsy_hourly_health", { hours_back: hoursBack });
  if (error) throw error;
  const byService = new Map<string, HourlyBucket[]>();
  for (const row of (data ?? []) as HourlyBucket[]) {
    const list = byService.get(row.service) ?? [];
    list.push(row);
    byService.set(row.service, list);
  }
  return byService;
}
