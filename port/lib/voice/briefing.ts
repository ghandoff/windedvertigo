/**
 * In-process briefing assembly for the voice agents.
 *
 * Replaces the previous worker-to-itself HTTP call to /api/{agent}/briefing
 * (edge round-trip + worker re-entry) with direct calls to the same pure
 * Supabase data functions the briefing routes use. This cuts first-token
 * latency so Vapi's custom-llm turn doesn't time out.
 *
 * The markdown formatting mirrors each agent's /briefing route so the spoken
 * agent sees the same working state. The brain routes are left untouched.
 */

import { getPamDecisions, getPamMemory, getPamCommitments } from "@/lib/supabase/pam";
import { getCmoDecisions, getCmoMemory } from "@/lib/supabase/cmo";
import { getCarlDecisions, getCarlMemory, getCarlFindings } from "@/lib/supabase/carl";
import {
  getLatestHealthChecks,
  getOpsyDecisions,
  getOpsyIncidents,
  getOpsyMemory,
  getOpsyPatterns,
  getRecentAutoFixes,
} from "@/lib/supabase/opsy";
import { SERVICES } from "@/lib/opsy/services";
import {
  getLatestSnapshots,
  getOpenFinItems,
  getUpcomingDeadlines,
  getRecentDecisions,
  getFinMemory,
} from "@/lib/fin-data";
import { getProjectsFromSupabase } from "@/lib/supabase/projects";
import { getDealsFromSupabase } from "@/lib/supabase/deals";
import { getCampaignsFromSupabase } from "@/lib/supabase/campaigns";
import { supabase } from "@/lib/supabase/client";
import type { VoiceSlug } from "./assistants";

// ── shared dashboard snapshot helpers ────────────────────────────────────────
// All helpers are fail-open: an error returns "" so the briefing continues.

const ACTIVE_PROJECT_STATUSES = new Set([
  "in queue", "in progress", "under review", "suspended",
]);

async function activeProjectsText(): Promise<string> {
  const { data } = await getProjectsFromSupabase({ archive: false }, { pageSize: 20 });
  const live = data.filter(p => ACTIVE_PROJECT_STATUSES.has(p.status));
  if (!live.length) return "_none_";
  return live.slice(0, 10).map(p => {
    const end = p.timeline?.end ? ` (due ${p.timeline.end})` : "";
    return `- [${p.status}] ${p.project}${end}`;
  }).join("\n");
}

async function openDealsText(): Promise<string> {
  const deals = await getDealsFromSupabase();
  const open = deals.filter(d => d.stage !== "lost");
  if (!open.length) return "_none_";
  return open.slice(0, 8).map(d => {
    const val = d.value != null && d.value > 0
      ? ` — $${Math.round(d.value).toLocaleString("en-US")}`
      : "";
    return `- [${d.stage}] ${d.deal}${val}`;
  }).join("\n");
}

async function upcomingMilestonesText(): Promise<string> {
  const today = new Date().toISOString().slice(0, 10);
  const in30 = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("milestones")
    .select("milestone, milestone_status, end_date")
    .gte("end_date", today)
    .lte("end_date", in30)
    .neq("milestone_status", "done")
    .eq("archive", false)
    .order("end_date", { ascending: true })
    .limit(8);
  if (error || !data?.length) return "_none_";
  return (data as { milestone: string; milestone_status: string | null; end_date: string }[])
    .map(m => `- ${m.milestone} — ${m.milestone_status ?? "not started"} (due ${m.end_date})`)
    .join("\n");
}

async function activeCampaignsText(): Promise<string> {
  const campaigns = await getCampaignsFromSupabase("active");
  if (!campaigns.length) return "_none_";
  return campaigns.slice(0, 5).map(c => {
    const end = c.endDate?.start ? ` (ends ${c.endDate.start})` : "";
    return `- [${c.type}] ${c.name}${end}`;
  }).join("\n");
}

const today = () => new Date().toISOString().slice(0, 10);

// ── pam ─────────────────────────────────────────────────────────────────────
async function pamBriefing(): Promise<string> {
  const t = today();
  const [decisions, memory, activeRaw, overdueRaw, projects, milestones, deals] = await Promise.all([
    getPamDecisions({ days: 14 }),
    getPamMemory(),
    getPamCommitments({ due_after: t }),
    getPamCommitments({ due_before: t }),
    activeProjectsText().catch(() => "_unavailable_"),
    upcomingMilestonesText().catch(() => "_unavailable_"),
    openDealsText().catch(() => "_unavailable_"),
  ]);
  const active = activeRaw.filter((c) => !["done", "parked"].includes(c.status));
  const overdue = overdueRaw.filter(
    (c) => !["done", "parked"].includes(c.status) && c.due_date,
  );
  const blocked = active.filter((c) => c.status === "blocked");

  const lines: string[] = ["# PaM briefing", ""];
  lines.push("## working state");
  for (const m of memory) lines.push(`- ${m.key}: ${m.value}`);
  lines.push("");
  lines.push("## active projects");
  lines.push(projects);
  lines.push("");
  lines.push("## upcoming milestones (30 days)");
  lines.push(milestones);
  lines.push("");
  lines.push("## bd pipeline (open deals)");
  lines.push(deals);
  lines.push("");
  if (overdue.length) {
    lines.push("## overdue commitments");
    for (const c of overdue) lines.push(`- ${c.who}: ${c.what} (due ${c.due_date})${c.blocker ? ` — blocked: ${c.blocker}` : ""}`);
    lines.push("");
  }
  if (blocked.length) {
    lines.push("## blocked commitments");
    for (const c of blocked) lines.push(`- ${c.who}: ${c.what} — ${c.blocker ?? "blocker not specified"}`);
    lines.push("");
  }
  lines.push("## active commitments");
  if (active.length) {
    for (const c of active) lines.push(`- [${c.status}] ${c.who}: ${c.what}${c.due_date ? ` (due ${c.due_date})` : ""}`);
  } else lines.push("_none_");
  lines.push("");
  lines.push("## recent conversations (14 days)");
  if (!decisions.length) lines.push("_none yet_");
  else for (const d of decisions) {
    lines.push(`- ${d.created_at.slice(0, 10)} · ${d.who}: ${d.summary}`);
    for (const dec of d.decisions ?? []) lines.push(`  · ${dec}`);
  }
  return lines.join("\n");
}

// ── cmo (Mo) ────────────────────────────────────────────────────────────────
async function cmoBriefing(): Promise<string> {
  const [decisions, memory, deals, campaigns] = await Promise.all([
    getCmoDecisions({ days: 14 }),
    getCmoMemory(),
    openDealsText().catch(() => "_unavailable_"),
    activeCampaignsText().catch(() => "_unavailable_"),
  ]);
  const lines: string[] = ["# Mo briefing", "", "## working state"];
  for (const m of memory) lines.push(`- ${m.key}: ${m.value}`);
  lines.push("", "## bd pipeline (open deals)");
  lines.push(deals);
  lines.push("", "## active campaigns");
  lines.push(campaigns);
  lines.push("", "## recent conversations (14 days)");
  if (!decisions.length) lines.push("_none yet_");
  else for (const d of decisions) {
    lines.push(`- ${d.created_at.slice(0, 10)} · ${d.who} (${d.session_type}): ${d.summary}`);
    for (const dec of d.decisions ?? []) lines.push(`  · ${dec}`);
  }
  return lines.join("\n");
}

// ── carl ──────────────────────────────────────────────────────────────────--
async function carlBriefing(): Promise<string> {
  const [decisions, memory, findings] = await Promise.all([
    getCarlDecisions({ days: 14 }),
    getCarlMemory(),
    getCarlFindings({ limit: 20 }),
  ]);
  const lines: string[] = ["# cARL briefing", "", "## working state"];
  for (const m of memory) lines.push(`- ${m.key}: ${m.value}`);
  lines.push("");
  if (findings.length) {
    lines.push("## recent library additions");
    const byDomain: Record<string, typeof findings> = {};
    for (const f of findings) (byDomain[f.domain] ??= []).push(f);
    for (const [domain, items] of Object.entries(byDomain)) {
      lines.push(`### ${domain}`);
      for (const f of items) lines.push(`- ${f.title} — ${f.summary.slice(0, 120)}${f.summary.length > 120 ? "…" : ""}`);
    }
    lines.push("");
  }
  lines.push("## recent conversations (14 days)");
  if (!decisions.length) lines.push("_none yet_");
  else for (const d of decisions) {
    lines.push(`- ${d.created_at.slice(0, 10)} · ${d.who}: ${d.summary}`);
    for (const dec of d.decisions ?? []) lines.push(`  · ${dec}`);
  }
  return lines.join("\n");
}

// ── opsy ──────────────────────────────────────────────────────────────────--
const LIGHT = { green: "🟢", amber: "🟡", red: "🔴" } as const;
async function opsyBriefing(): Promise<string> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [memory, decisions, latest, openIncidents, recentIncidents, autoFixes, patterns] = await Promise.all([
    getOpsyMemory(),
    getOpsyDecisions({ days: 14 }),
    getLatestHealthChecks(),
    getOpsyIncidents({ status: "open", limit: 25 }),
    getOpsyIncidents({ since: sevenDaysAgo, limit: 50 }),
    getRecentAutoFixes(7),
    getOpsyPatterns(),
  ]);
  const latestByService = new Map(latest.map((c) => [c.service, c]));
  const lines: string[] = ["# Opsy briefing", "", "## current health (tier 1)"];
  for (const svc of SERVICES) {
    const c = latestByService.get(svc.id);
    lines.push(c ? `- ${LIGHT[c.status]} ${svc.id} — ${c.response_time_ms}ms` : `- ⚪ ${svc.id} — no recent check`);
  }
  lines.push("", "## open incidents");
  if (!openIncidents.length) lines.push("_none — all clear_");
  else for (const i of openIncidents) lines.push(`- [${i.severity}] ${i.service} — ${i.symptoms}`);
  lines.push("");
  const resolved = recentIncidents.filter((i) => i.status === "resolved");
  if (resolved.length) {
    lines.push("## incidents resolved (7 days)");
    for (const i of resolved) lines.push(`- ${i.service} — ${i.symptoms}${i.remediation ? ` → ${i.remediation}` : ""}`);
    lines.push("");
  }
  if (autoFixes.length) {
    lines.push("## auto-fixes (7 days)");
    for (const f of autoFixes) lines.push(`- ${f.action} — ${f.result}`);
    lines.push("");
  }
  if (patterns.length) {
    lines.push("## learned patterns");
    for (const p of patterns) lines.push(`- ${p.pattern_type} (${p.services.join(", ")}, ${p.occurrence_count}×): ${p.description}`);
    lines.push("");
  }
  lines.push("## working state");
  for (const m of memory) lines.push(`- ${m.key}: ${m.value}`);
  lines.push("", "## recent conversations (14 days)");
  if (!decisions.length) lines.push("_none yet_");
  else for (const d of decisions) {
    lines.push(`- ${d.created_at.slice(0, 10)} · ${d.who}: ${d.summary}`);
    for (const dec of d.decisions ?? []) lines.push(`  · ${dec}`);
  }
  return lines.join("\n");
}

// ── fin ──────────────────────────────────────────────────────────────────--
function usd(cents: unknown): string | null {
  return typeof cents === "number" ? `$${Math.round(cents / 100).toLocaleString("en-US")}` : null;
}
async function finBriefing(): Promise<string> {
  const [snapshots, openItems, upcoming, decisions, memory] = await Promise.all([
    getLatestSnapshots(),
    getOpenFinItems(),
    getUpcomingDeadlines(30),
    getRecentDecisions(10),
    getFinMemory(),
  ]);
  const lines: string[] = ["# Fin briefing"];
  if (memory.length) {
    lines.push("", "## working state");
    for (const m of memory) lines.push(`- ${m.key}: ${m.value}`);
  }
  const snapEntries = Object.entries(snapshots).filter(([, s]) => s);
  if (snapEntries.length) {
    lines.push("", "## latest financial snapshots");
    for (const [type, s] of snapEntries) {
      const label = s?.period_label ? ` (${s.period_label})` : "";
      lines.push(`- ${type}${label}: ${(s?.data ? JSON.stringify(s.data) : "").slice(0, 600)}`);
    }
  }
  if (openItems.length) {
    lines.push("", `## open items (${openItems.length})`);
    for (const i of openItems.slice(0, 25)) {
      const amt = usd(i.amount_cents);
      lines.push(`- [${i.type}] ${i.title}${amt ? ` — ${amt}` : ""}${i.due_date ? ` due ${i.due_date}` : ""}`);
    }
  }
  if (upcoming.length) {
    lines.push("", "## upcoming recurring costs (30 days)");
    for (const d of upcoming.slice(0, 25)) {
      const amt = usd(d.typical_amount_cents);
      const when = d.next_expected ? `${d.next_expected}: ` : "";
      lines.push(`- ${when}${d.vendor} — ${d.description}${amt ? ` (~${amt})` : ""}`);
    }
  }
  if (decisions.length) {
    lines.push("", "## recent decisions");
    for (const d of decisions.slice(0, 10)) lines.push(`- ${d.decision}${d.context ? ` (${d.context})` : ""}`);
  }
  return lines.length > 1 ? lines.join("\n") : "(no financial data recorded yet.)";
}

const BUILDERS: Record<Exclude<VoiceSlug, "claude">, () => Promise<string>> = {
  pam: pamBriefing,
  cmo: cmoBriefing,
  carl: carlBriefing,
  fin: finBriefing,
  opsy: opsyBriefing,
};

/**
 * Assemble an agent's briefing in-process. Returns "" for the memory-less
 * Claude line, and "" on any error (fail-open — the agent still answers).
 */
export async function buildVoiceBriefing(slug: VoiceSlug): Promise<string> {
  const builder = (BUILDERS as Record<string, (() => Promise<string>) | undefined>)[slug];
  if (!builder) return "";
  try {
    return await builder();
  } catch (err) {
    console.warn("[voice] in-process briefing failed:", err instanceof Error ? err.message : err);
    return "";
  }
}
