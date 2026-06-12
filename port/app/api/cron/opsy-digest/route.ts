/**
 * Opsy weekly operations digest — mondays 07:00 UTC (CRON_TABLE).
 *
 * Runs the weekly learning pass (detectPatterns), gathers the week's
 * operational story (uptime per platform, incidents opened/resolved,
 * auto-fixes, email captures, patterns, locked checks awaiting credentials),
 * has Haiku write it in Opsy's posture voice, and posts to #ops-alerts.
 *
 * Auth: CRON_SECRET or CMO_API_TOKEN (same as the other opsy crons).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import { callClaude } from "@/lib/ai/client";
import { postOpsNote } from "@/lib/opsy/alerts";
import { detectPatterns } from "@/lib/opsy/patterns";
import { buildHealthRollup } from "@/lib/opsy/rollup";
import {
  getOpsyPatterns,
  getRecentAutoFixes,
  getRecentCronFailures,
} from "@/lib/supabase/opsy";
import { supabase } from "@/lib/supabase/client";

export const maxDuration = 120;

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return false;
  return token === process.env.CRON_SECRET || token === process.env.CMO_API_TOKEN;
}

const SYSTEM = `you are opsy, winded.vertigo's operations agent, writing the weekly ops digest for #ops-alerts. voice: calm, lowercase, plain language, never alarmist — infrastructure issues are routine. format for slack mrkdwn (*bold*, bullet lines with •). structure: one-line health verdict, then short sections only where there's something to say (incidents, auto-fixes, patterns worth knowing, what's still locked awaiting credentials). end with at most one recommendation. keep it under 200 words.`;

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    // weekly learning pass first, so the digest reports fresh patterns
    const patternsRun = await detectPatterns().catch(() => ({ detected: [] }));

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [rollup, autoFixes, cronFailures, patterns, emailCaptures] = await Promise.all([
      buildHealthRollup(),
      getRecentAutoFixes(7),
      getRecentCronFailures(7),
      getOpsyPatterns(),
      supabase
        .from("opsy_email_captures")
        .select("service, severity, action_taken")
        .gte("processed_at", sevenDaysAgo)
        .limit(100)
        .then((r) => r.data ?? []),
    ]);

    const incidents = rollup.incidents_7d;
    // services with no stored checks are the ones still skipping (locked
    // awaiting credentials) — derived from the rollup, no probe side effects
    const lockedServices = Object.entries(rollup.services)
      .filter(([, s]) => s.status === "unknown" && s.last_check === null)
      .map(([id]) => id);

    const facts = [
      `platform uptime 24h: ${Object.entries(rollup.platforms)
        .map(([k, p]) => `${k} ${p.uptime_24h ?? "?"}% (${p.status})`)
        .join(", ")}`,
      `incidents this week: ${incidents.length} total — ${incidents.filter((i) => i.severity === "critical").length} critical, ${incidents.filter((i) => i.severity === "warning").length} warning; ${incidents.filter((i) => i.status === "resolved").length} resolved, ${incidents.filter((i) => i.status !== "resolved").length} still open`,
      incidents.length
        ? `incident details: ${incidents.slice(0, 8).map((i) => `[${i.severity}] ${i.service}: ${i.symptoms.slice(0, 100)}${i.status === "resolved" ? " (resolved)" : ""}`).join(" || ")}`
        : "no incidents",
      `auto-fixes: ${autoFixes.length} (${autoFixes.filter((f) => f.result === "success").length} successful)`,
      `cron failures recorded: ${cronFailures.length}`,
      `infrastructure emails captured: ${emailCaptures.length}`,
      `recurring patterns on file: ${patterns.length}${patternsRun.detected.length ? ` (updated this run: ${patternsRun.detected.map((d) => `${d.service}×${d.count}`).join(", ")})` : ""}`,
      `checks still locked awaiting credentials: ${lockedServices.join(", ") || "none"}`,
    ].join("\n");

    const result = await callClaude({
      feature: "opsy-digest",
      system: SYSTEM,
      userMessage: `this week's operational facts:\n\n${facts}`,
      userId: "system-cron",
      maxTokens: 600,
      temperature: 0.3,
    });

    const message = `:clipboard: *weekly ops digest*\n\n${result.text}`;
    await postOpsNote(message);

    return json({
      message: "digest posted",
      incidents: incidents.length,
      auto_fixes: autoFixes.length,
      patterns_detected: patternsRun.detected.length,
      costUsd: result.costUsd,
    });
  } catch (err) {
    console.error("[cron/opsy-digest] failed:", err);
    return error("digest failed", 500);
  }
}
