/**
 * GET /api/opsy/briefing — Opsy's full working state as a markdown briefing:
 * current platform health, open + recent incidents, auto-fix history, learned
 * patterns, working-state memory, and 14 days of conversation history. Same
 * shape as the other agents' briefings (cmo/pam/carl).
 */

import { NextRequest } from "next/server";
import { json, error } from "@/lib/api-helpers";
import {
  getLatestHealthChecks,
  getOpsyDecisions,
  getOpsyIncidents,
  getOpsyMemory,
  getOpsyPatterns,
  getRecentAutoFixes,
} from "@/lib/supabase/opsy";
import { SERVICES } from "@/lib/opsy/services";

function verifyAuth(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return !!token && token === process.env.CMO_API_TOKEN;
}

const LIGHT = { green: "🟢", amber: "🟡", red: "🔴" } as const;

export async function GET(req: NextRequest) {
  if (!verifyAuth(req)) return error("unauthorized", 401);

  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const [memory, decisions, latest, openIncidents, recentIncidents, autoFixes, patterns] =
      await Promise.all([
        getOpsyMemory(),
        getOpsyDecisions({ days: 14 }),
        getLatestHealthChecks(),
        getOpsyIncidents({ status: "open", limit: 25 }),
        getOpsyIncidents({ since: sevenDaysAgo, limit: 50 }),
        getRecentAutoFixes(7),
        getOpsyPatterns(),
      ]);

    const latestByService = new Map(latest.map((c) => [c.service, c]));
    const lines: string[] = [];

    lines.push("# Opsy briefing");
    lines.push(`_generated ${new Date().toISOString().slice(0, 16)} UTC_`);
    lines.push("");

    lines.push("## current health (tier 1)");
    for (const svc of SERVICES) {
      const c = latestByService.get(svc.id);
      if (!c) {
        lines.push(`- ⚪ **${svc.id}** — no recent check`);
      } else {
        lines.push(
          `- ${LIGHT[c.status]} **${svc.id}** — ${c.response_time_ms}ms _(checked ${c.checked_at.slice(0, 16)} UTC)_`,
        );
      }
    }
    lines.push("");

    lines.push("## open incidents");
    if (openIncidents.length === 0) {
      lines.push("_none — all clear_");
    } else {
      for (const i of openIncidents) {
        lines.push(`- **[${i.severity}] ${i.service}** — ${i.symptoms} _(opened ${i.opened_at.slice(0, 16)} UTC)_`);
      }
    }
    lines.push("");

    const resolved = recentIncidents.filter((i) => i.status === "resolved");
    lines.push("## incidents resolved (7 days)");
    if (resolved.length === 0) {
      lines.push("_none_");
    } else {
      for (const i of resolved) {
        lines.push(`- **${i.service}** — ${i.symptoms}${i.remediation ? ` → ${i.remediation}` : ""}`);
      }
    }
    lines.push("");

    if (autoFixes.length > 0) {
      lines.push("## auto-fixes (7 days)");
      for (const f of autoFixes) {
        lines.push(`- ${f.action} — ${f.result} _(${f.executed_at.slice(0, 16)} UTC)_`);
      }
      lines.push("");
    }

    if (patterns.length > 0) {
      lines.push("## learned patterns");
      for (const p of patterns) {
        lines.push(
          `- **${p.pattern_type}** (${p.services.join(", ")}, seen ${p.occurrence_count}×): ${p.description}${p.recommendation ? ` — _${p.recommendation}_` : ""}`,
        );
      }
      lines.push("");
    }

    lines.push("## working state");
    for (const m of memory) {
      lines.push(`- **${m.key}**: ${m.value} _(updated ${m.updated_at.slice(0, 10)} by ${m.updated_by})_`);
    }
    lines.push("");

    lines.push("## recent conversations (14 days)");
    if (decisions.length === 0) {
      lines.push("_no conversations recorded yet_");
    } else {
      for (const d of decisions) {
        lines.push(`### ${d.created_at.slice(0, 10)} · ${d.who} (${d.session_type})`);
        lines.push(d.summary);
        for (const dec of d.decisions ?? []) lines.push(`- ${dec}`);
        if (d.tags?.length) lines.push(`_tags: ${d.tags.join(", ")}_`);
        lines.push("");
      }
    }

    return json({
      briefing: lines.join("\n"),
      open_incidents: openIncidents.length,
      decisions_count: decisions.length,
      memory_count: memory.length,
    });
  } catch (err) {
    console.error("[api/opsy/briefing] GET failed:", err);
    return error("failed to generate briefing", 500);
  }
}
