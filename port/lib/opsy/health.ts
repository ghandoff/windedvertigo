/**
 * Opsy's health-check engine (phase 1: tier-1 HTTP probes).
 *
 * For each service in scope: GET the probe URL, measure wall-clock time, and
 * classify — red (network error or HTTP ≥ 400), amber (healthy but slower than
 * the service's posture threshold), green otherwise. Results are stored in
 * opsy_health_checks; threshold breaches open incidents and recoveries
 * auto-resolve them.
 *
 * Incident hygiene:
 *   - one live auto-created incident per service (deduped via metadata.auto_created)
 *   - a green check resolves the auto-created incident, never human-logged ones
 *   - phase 2 will add hysteresis (N consecutive reds) + slack routing
 */

import {
  getOpenAutoIncident,
  insertOpsyHealthChecks,
  insertOpsyIncident,
  resolveOpsyIncident,
} from "@/lib/supabase/opsy";
import { servicesForScope, type CheckScope, type MonitoredService } from "./services";

const PROBE_TIMEOUT_MS = 10_000;

export interface ProbeResult {
  service: string;
  status: "green" | "amber" | "red";
  response_time_ms: number;
  status_code: number | null;
  error: string | null;
}

export interface CheckRunResult {
  scope: CheckScope;
  checked: number;
  results: ProbeResult[];
  incidents_opened: string[];
  incidents_resolved: string[];
  checked_at: string;
}

async function probe(service: MonitoredService): Promise<ProbeResult> {
  const started = Date.now();
  try {
    const res = await fetch(service.url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { "User-Agent": "opsy-health-check/1.0 (+https://port.windedvertigo.com/ops)" },
    });
    const ms = Date.now() - started;
    // drain the body so the connection is released cleanly on workers
    await res.arrayBuffer().catch(() => undefined);

    if (res.status >= 400) {
      return { service: service.id, status: "red", response_time_ms: ms, status_code: res.status, error: null };
    }
    if (ms > service.amberMs) {
      return { service: service.id, status: "amber", response_time_ms: ms, status_code: res.status, error: null };
    }
    return { service: service.id, status: "green", response_time_ms: ms, status_code: res.status, error: null };
  } catch (err) {
    return {
      service: service.id,
      status: "red",
      response_time_ms: Date.now() - started,
      status_code: null,
      error: err instanceof Error ? err.message : "unknown fetch error",
    };
  }
}

function symptomsFor(service: MonitoredService, r: ProbeResult): string {
  if (r.error) return `${service.name} unreachable: ${r.error} (after ${r.response_time_ms}ms)`;
  if (r.status_code && r.status_code >= 400) {
    return `${service.name} returning HTTP ${r.status_code} on ${service.url}`;
  }
  return `${service.name} slow: ${r.response_time_ms}ms response (threshold ${service.amberMs}ms)`;
}

export async function runHealthChecks(scope: CheckScope = "tier1"): Promise<CheckRunResult> {
  const services = servicesForScope(scope);
  const results = await Promise.all(services.map(probe));

  await insertOpsyHealthChecks(
    results.map((r) => ({
      service: r.service,
      status: r.status,
      response_time_ms: r.response_time_ms,
      details: { status_code: r.status_code, error: r.error, scope },
    })),
  );

  const incidents_opened: string[] = [];
  const incidents_resolved: string[] = [];

  for (const r of results) {
    const service = services.find((s) => s.id === r.service)!;
    const existing = await getOpenAutoIncident(r.service);

    if (r.status === "green") {
      if (existing) {
        await resolveOpsyIncident(
          existing.id,
          `recovered — health check returned green (${r.response_time_ms}ms) at ${new Date().toISOString()}`,
        );
        incidents_resolved.push(existing.id);
      }
      continue;
    }

    if (existing) continue; // already tracking this outage/slowdown

    const { id } = await insertOpsyIncident({
      service: r.service,
      severity: r.status === "red" ? "critical" : "warning",
      symptoms: symptomsFor(service, r),
      metadata: {
        auto_created: true,
        status_code: r.status_code,
        response_time_ms: r.response_time_ms,
        probe_url: service.url,
      },
    });
    incidents_opened.push(id);
  }

  return {
    scope,
    checked: results.length,
    results,
    incidents_opened,
    incidents_resolved,
    checked_at: new Date().toISOString(),
  };
}
