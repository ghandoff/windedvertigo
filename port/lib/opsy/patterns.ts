/**
 * Opsy's learning layer, v1: deterministic recurrence detection
 * (docs/opsy/posture.md §3 — "learn from every incident").
 *
 * A service with ≥3 incidents in 90 days is a pattern: upserted into
 * opsy_patterns with a templated recommendation, surfaced on the /ops
 * dashboard and in the weekly digest, and appended to slack alerts when a
 * matching incident opens ("this is the Nth time…"). AI-assisted correlation
 * across services can come later — recurrence needs no model.
 */

import { getOpsyIncidents, getOpsyPatterns, upsertOpsyPattern } from "@/lib/supabase/opsy";

const WINDOW_DAYS = 90;
const THRESHOLD = 3;

export interface PatternDetectionResult {
  detected: Array<{ service: string; count: number }>;
}

/** Weekly learning pass — group 90d of incidents by service, upsert patterns. */
export async function detectPatterns(): Promise<PatternDetectionResult> {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const incidents = await getOpsyIncidents({ since, limit: 500 });

  const byService = new Map<string, typeof incidents>();
  for (const i of incidents) {
    const list = byService.get(i.service) ?? [];
    list.push(i);
    byService.set(i.service, list);
  }

  const detected: Array<{ service: string; count: number }> = [];
  for (const [service, list] of byService) {
    if (list.length < THRESHOLD) continue;
    const lastSeen = list[0].opened_at; // getOpsyIncidents is newest-first
    const severities = [...new Set(list.map((i) => i.severity))].join("/");
    await upsertOpsyPattern({
      pattern_type: "recurring-incident",
      description: `${service} has had ${list.length} incidents (${severities}) in the last ${WINDOW_DAYS} days`,
      services: [service],
      occurrence_count: list.length,
      last_seen: lastSeen,
      recommendation: `recurring failures on ${service} — worth a root-cause look rather than another auto-fix. recent symptoms: ${list
        .slice(0, 3)
        .map((i) => i.symptoms.slice(0, 80))
        .join(" | ")}`,
    });
    detected.push({ service, count: list.length });
  }

  return { detected };
}

/**
 * "This is the Nth time" context for a newly opened incident. Returns a
 * one-line hint when the service has recurred, null otherwise. Fail-open —
 * alerting must never break on the learning layer.
 */
export async function recurrenceHint(service: string): Promise<string | null> {
  try {
    const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const incidents = await getOpsyIncidents({ service, since, limit: 50 });
    if (incidents.length < THRESHOLD) return null;
    const pattern = (await getOpsyPatterns()).find((p) => p.services.includes(service));
    return `this is incident #${incidents.length} for ${service} in ${WINDOW_DAYS} days${pattern?.recommendation ? ` — ${pattern.recommendation.split("—")[0].trim()}` : ""}`;
  } catch (err) {
    console.warn("[opsy/patterns] recurrenceHint failed:", err);
    return null;
  }
}
