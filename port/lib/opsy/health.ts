/**
 * Opsy's health-check engine.
 *
 * Two checker kinds (lib/opsy/services.ts):
 *   http   — timed GET of the service URL; red on network error or HTTP ≥ 400,
 *            amber when slower than the posture threshold, green otherwise.
 *   custom — tier 2-4 checkers in lib/opsy/checks.ts (data layer, external
 *            APIs, security audits). May return "skipped" when a credential
 *            is missing — skipped results are reported in the run summary but
 *            NOT stored and never open incidents.
 *
 * Results are stored in opsy_health_checks; threshold breaches open incidents,
 * recoveries auto-resolve them, and both route to slack (lib/opsy/alerts.ts).
 *
 * Incident hygiene:
 *   - one live auto-created incident per service (deduped via metadata.auto_created)
 *   - a green check resolves the auto-created incident, never human-logged ones
 *   - hysteresis (N consecutive reds) is a known future refinement
 */

import {
  getOpenAutoIncident,
  insertOpsyHealthChecks,
  insertOpsyIncident,
  resolveOpsyIncident,
} from "@/lib/supabase/opsy";
import { notifyIncidentOpened, notifyIncidentResolved } from "./alerts";
import { CHECKERS } from "./checks";
import { recurrenceHint } from "./patterns";
import { servicesForScope, type CheckScope, type MonitoredService } from "./services";

const PROBE_TIMEOUT_MS = 10_000;

export interface ProbeResult {
  service: string;
  status: "green" | "amber" | "red" | "skipped";
  response_time_ms: number | null;
  status_code: number | null;
  error: string | null;
  /** checker-provided incident description (custom checks) */
  symptoms?: string;
  details?: Record<string, unknown>;
}

export interface CheckRunResult {
  scope: CheckScope;
  checked: number;
  skipped: number;
  results: ProbeResult[];
  incidents_opened: string[];
  incidents_resolved: string[];
  checked_at: string;
}

async function probeHttp(service: MonitoredService): Promise<ProbeResult> {
  const url = service.url!;
  const amberMs = service.amberMs ?? 2000;
  const started = Date.now();
  try {
    const res = await fetch(url, {
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
    if (ms > amberMs) {
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

async function runChecker(service: MonitoredService): Promise<ProbeResult> {
  const checker = CHECKERS[service.id];
  if (!checker) {
    return {
      service: service.id,
      status: "skipped",
      response_time_ms: null,
      status_code: null,
      error: null,
      details: { reason: `no checker registered for '${service.id}'` },
    };
  }
  const r = await checker();
  return {
    service: service.id,
    status: r.status,
    response_time_ms: r.response_time_ms,
    status_code: null,
    error: r.status === "red" ? (r.symptoms ?? null) : null,
    symptoms: r.symptoms,
    details: r.details,
  };
}

function symptomsFor(service: MonitoredService, r: ProbeResult): string {
  if (r.symptoms) return r.symptoms;
  if (r.error) return `${service.name} unreachable: ${r.error} (after ${r.response_time_ms}ms)`;
  if (r.status_code && r.status_code >= 400) {
    return `${service.name} returning HTTP ${r.status_code} on ${service.url}`;
  }
  return `${service.name} slow: ${r.response_time_ms}ms response (threshold ${service.amberMs ?? 2000}ms)`;
}

export async function runHealthChecks(scope: CheckScope = "tier1"): Promise<CheckRunResult> {
  const services = servicesForScope(scope);
  const results = await Promise.all(
    services.map((s) => (s.kind === "custom" ? runChecker(s) : probeHttp(s))),
  );

  const active = results.filter((r) => r.status !== "skipped");

  if (active.length) {
    await insertOpsyHealthChecks(
      active.map((r) => ({
        service: r.service,
        status: r.status as "green" | "amber" | "red",
        response_time_ms: r.response_time_ms,
        details: { status_code: r.status_code, error: r.error, scope, ...(r.details ?? {}) },
      })),
    );
  }

  const incidents_opened: string[] = [];
  const incidents_resolved: string[] = [];

  for (const r of active) {
    const service = services.find((s) => s.id === r.service)!;
    const existing = await getOpenAutoIncident(r.service);

    if (r.status === "green") {
      if (existing) {
        const resolution = `recovered — health check returned green (${r.response_time_ms}ms) at ${new Date().toISOString()}`;
        await resolveOpsyIncident(existing.id, resolution);
        incidents_resolved.push(existing.id);
        await notifyIncidentResolved(existing, resolution);
      }
      continue;
    }

    if (existing) continue; // already tracking this outage/slowdown

    const severity = r.status === "red" ? ("critical" as const) : ("warning" as const);
    const symptoms = symptomsFor(service, r);
    const { id, opened_at } = await insertOpsyIncident({
      service: r.service,
      severity,
      symptoms,
      metadata: {
        auto_created: true,
        status_code: r.status_code,
        response_time_ms: r.response_time_ms,
        probe_url: service.url,
        tier: service.tier,
      },
    });
    incidents_opened.push(id);
    const pattern = await recurrenceHint(r.service);
    await notifyIncidentOpened({ id, service: r.service, severity, symptoms, opened_at, pattern });
  }

  return {
    scope,
    checked: active.length,
    skipped: results.length - active.length,
    results,
    incidents_opened,
    incidents_resolved,
    checked_at: new Date().toISOString(),
  };
}
