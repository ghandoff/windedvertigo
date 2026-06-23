/**
 * POST /api/mcp/agents/[agent] — remote MCP server for the Mo / PaM / cARL /
 * Opsy memory layer, over HTTP (JSON-RPC 2.0). This is the Cowork-compatible twin of
 * the local stdio servers in docs/plugins/* : Claude Desktop / Cowork runs in a
 * VM and cannot launch local `node index.js`, so the tools must arrive as a
 * remote URL. Same tools, same backend — this route is a thin protocol shim in
 * front of the existing /api/{cmo,pam,carl}/* API (self-fetched via PORT_URL,
 * the established internal-call pattern in this app).
 *
 * agent ∈ { mo (alias cmo) | pam | carl | opsy }. Auth: Bearer CMO_API_TOKEN — the same
 * shared agent token the local servers use (WV_AGENT_TOKEN). Path is exempt from
 * session auth in middleware (/api/mcp/*).
 */

import { NextRequest, NextResponse } from "next/server";
import { RESOURCE, PROTECTED_RESOURCE_METADATA_URL, oauthSecret, isAllowedEmail } from "@/lib/oauth/config";
import { verifyJwt } from "@/lib/oauth/jwt";

export const maxDuration = 60;

const PORT_URL = process.env.PORT_URL ?? "https://port.windedvertigo.com";

// ── self-fetch the agent API (same pattern the local stdio servers use) ──────
async function apiFetch(
  path: string,
  token: string,
  init: RequestInit = {},
): Promise<Record<string, unknown> | unknown[]> {
  const res = await fetch(`${PORT_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

// ── agent specs (tool catalogs ported from docs/plugins/*/index.js) ──────────

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
interface ToolResult {
  text: string;
  isError?: boolean;
}
interface AgentSpec {
  serverName: string;
  title: string;
  instructions: string;
  tools: ToolDef[];
  call: (name: string, args: Record<string, unknown>, token: string) => Promise<ToolResult>;
}

const STR = { type: "string" } as const;
const STR_ARR = { type: "array", items: { type: "string" } } as const;

// ---- Mo (CMO) ----
const MO_TOOLS: ToolDef[] = [
  { name: "cmo_briefing", description: "Load Mo's full working state — current strategy, pipeline, recent decisions, and 14 days of conversation history. Call silently at session start.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "cmo_log_decision", description: "Log a decision or insight from the current conversation to Mo's persistent memory. Call during conversation when a strategic decision is made, not at the end.", inputSchema: { type: "object", properties: { who: { ...STR, description: "Name of the person in the conversation (e.g. 'garrett')" }, summary: { ...STR, description: "Summary of what was discussed" }, decisions: { ...STR_ARR, description: "List of specific decisions made" }, tags: { ...STR_ARR, description: "Relevant tags e.g. ['pipeline', 'harbour', 'brand']" }, session_type: { ...STR, description: "Session type, default 'cowork'" } }, required: ["who", "summary"] } },
  { name: "cmo_update_memory", description: "Update a key in Mo's working state memory. Use when strategic state changes — pipeline numbers, priorities, statuses.", inputSchema: { type: "object", properties: { key: { ...STR, description: "Memory key (e.g. 'pipeline-total')" }, value: { ...STR, description: "New value" }, updated_by: { ...STR, description: "Who made the update (e.g. 'garrett')" } }, required: ["key", "value", "updated_by"] } },
];

async function callMo(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name === "cmo_briefing") {
    const d = (await apiFetch("/api/cmo/briefing", token)) as { briefing: string };
    return { text: d.briefing };
  }
  if (name === "cmo_log_decision") {
    const d = (await apiFetch("/api/cmo/decisions", token, { method: "POST", body: JSON.stringify({ who: a.who, summary: a.summary, decisions: a.decisions ?? [], tags: a.tags ?? [], session_type: a.session_type ?? "cowork" }) })) as { id: string };
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "cmo_update_memory") {
    const d = (await apiFetch("/api/cmo/memory", token, { method: "POST", body: JSON.stringify({ key: a.key, value: a.value, updated_by: a.updated_by }) })) as { key: string };
    return { text: `memory updated: ${d.key}` };
  }
  if (name === "cmo_request_research") {
    const d = (await apiFetch("/api/carl/curriculum", token, {
      method: "POST",
      body: JSON.stringify({ domain: a.domain, topic: a.topic, key_works: a.key_works ?? [], priority: 1, notes: a.context || undefined, requested_by: "mo" }),
    })) as { id?: string };
    return { text: `research request queued for cARL (priority 1) — ${a.domain}: ${a.topic}. cARL will synthesise findings at the next daily run and post a digest to #canon.${d.id ? ` [id: ${d.id}]` : ""}` };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

// ---- PaM ----
const PAM_TOOLS: ToolDef[] = [
  { name: "pam_briefing", description: "Load PaM's full working state — active commitments, overdue items, blocked dependencies, working state, and 14 days of conversation history. Call silently at session start.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "pam_log_decision", description: "Log a project-level decision or context shift to PaM's persistent memory. Call when commitments are made, status changes, or blockers surface.", inputSchema: { type: "object", properties: { who: { ...STR, description: "Name of the person in the conversation" }, summary: { ...STR, description: "Summary of what was discussed" }, decisions: { ...STR_ARR, description: "List of specific decisions or action items" }, tags: { ...STR_ARR, description: "Relevant tags e.g. ['commitments', 'blockers', 'whirlpool']" }, session_type: { ...STR, description: "Session type, default 'cowork'" } }, required: ["who", "summary"] } },
  { name: "pam_update_memory", description: "Update a key in PaM's working state memory. Use when team state changes — someone's focus shifts, overdue items resolve, next whirlpool is scheduled.", inputSchema: { type: "object", properties: { key: { ...STR, description: "Memory key (e.g. 'garrett-commitments')" }, value: { ...STR, description: "New value" }, updated_by: { ...STR, description: "Who made the update" } }, required: ["key", "value", "updated_by"] } },
  { name: "pam_create_commitment", description: "Create a new commitment in PaM's tracker. Use when a team member commits to doing something in a conversation.", inputSchema: { type: "object", properties: { who: { ...STR, description: "Person making the commitment (e.g. 'garrett')" }, what: { ...STR, description: "What they committed to" }, start_date: { ...STR, description: "Start date YYYY-MM-DD (optional — enables a Gantt bar span)" }, due_date: { ...STR, description: "Due date YYYY-MM-DD (optional)" }, source: { ...STR, description: "Where it was committed (e.g. 'whirlpool', 'cowork', 'slack')" }, depends_on: { ...STR_ARR, description: "IDs of commitments this depends on (optional)" } }, required: ["who", "what"] } },
  { name: "pam_update_commitment", description: "Update the status of an existing commitment. Use when something is done, blocked, or changes.", inputSchema: { type: "object", properties: { id: { ...STR, description: "UUID of the commitment to update" }, status: { type: "string", enum: ["not-started", "in-progress", "blocked", "done", "parked"], description: "New status" }, blocker: { ...STR, description: "What's blocking it (if status is 'blocked')" }, completed_at: { ...STR, description: "Completion timestamp ISO (if marking done)" }, start_date: { ...STR, description: "Start date YYYY-MM-DD (optional)" }, due_date: { ...STR, description: "Due date YYYY-MM-DD (optional)" } }, required: ["id"] } },
];

async function callPam(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name === "pam_briefing") {
    const d = (await apiFetch("/api/pam/briefing", token)) as { briefing: string };
    return { text: d.briefing };
  }
  if (name === "pam_log_decision") {
    const d = (await apiFetch("/api/pam/decisions", token, { method: "POST", body: JSON.stringify({ who: a.who, summary: a.summary, decisions: a.decisions ?? [], tags: a.tags ?? [], session_type: a.session_type ?? "cowork" }) })) as { id: string };
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "pam_update_memory") {
    const d = (await apiFetch("/api/pam/memory", token, { method: "POST", body: JSON.stringify({ key: a.key, value: a.value, updated_by: a.updated_by }) })) as { key: string };
    return { text: `memory updated: ${d.key}` };
  }
  if (name === "pam_create_commitment") {
    const d = (await apiFetch("/api/pam/commitments", token, { method: "POST", body: JSON.stringify({ who: a.who, what: a.what, start_date: a.start_date || undefined, due_date: a.due_date || undefined, source: a.source || undefined, depends_on: a.depends_on || undefined }) })) as { id: string };
    return { text: `commitment created (id: ${d.id}) — ${a.who}: ${a.what}` };
  }
  if (name === "pam_update_commitment") {
    if (!a.id) return { text: "id is required", isError: true };
    const update: Record<string, unknown> = {};
    for (const k of ["status", "blocker", "completed_at", "start_date", "due_date"]) {
      if (a[k]) update[k] = a[k];
    }
    const d = (await apiFetch(`/api/pam/commitments?id=${encodeURIComponent(String(a.id))}`, token, { method: "PATCH", body: JSON.stringify(update) })) as { who: string; what: string; status: string };
    return { text: `commitment updated — ${d.who}: ${d.what} [${d.status}]` };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

// ---- cARL ----
const CARL_TOOLS: ToolDef[] = [
  { name: "carl_briefing", description: "Load cARL's full working state — active research domains, recent library findings, working state, and 14 days of conversation history. Call silently at session start.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "carl_log_decision", description: "Log a research decision or direction to cARL's persistent memory — when a framework is adopted, a domain is prioritised, or a key insight is confirmed.", inputSchema: { type: "object", properties: { who: { ...STR, description: "Name of the person in the conversation" }, summary: { ...STR, description: "Summary of what was discussed" }, decisions: { ...STR_ARR, description: "Specific research decisions or directions adopted" }, tags: { ...STR_ARR, description: "Research domain tags e.g. ['threshold-concepts', 'harbour', 'UDL']" }, session_type: { ...STR, description: "Session type, default 'cowork'" } }, required: ["who", "summary"] } },
  { name: "carl_update_memory", description: "Update a key in cARL's working state memory. Use when research priorities shift, a new domain becomes active, or a framework is adopted.", inputSchema: { type: "object", properties: { key: { ...STR, description: "Memory key (e.g. 'active-research-domains')" }, value: { ...STR, description: "New value" }, updated_by: { ...STR, description: "Who made the update" } }, required: ["key", "value", "updated_by"] } },
  { name: "carl_add_finding", description: "Add a synthesised finding to cARL's living research library. Call when a relevant study, framework, or insight is surfaced that connects to the team's work. domain MUST be a canonical label from the vocabulary — call GET /api/carl/domains if unsure what's available.", inputSchema: { type: "object", properties: { domain: { ...STR, description: "Canonical research domain label — must match an entry in the vocabulary (e.g. 'threshold concepts', 'play-based & experiential pedagogy', 'learning design & UDL', 'ai in education', 'cognitive psychology', 'mo · strategy', 'pam · project management'). Reject non-canonical strings." }, subtopic: { ...STR, description: "Optional fine-grain context within the domain (e.g. 'embodied cognition', 'memory', 'SLIMM'). Keeps the domain canonical while preserving nuance." }, title: { ...STR, description: "Clear descriptive title of the finding" }, summary: { ...STR, description: "1-3 sentence distilled insight (not raw notes)" }, source: { ...STR, description: "Author(s) and title of the source" }, citation: { ...STR, description: "Enough detail to find the source (author, year, journal/book)" }, relevance: { ...STR, description: "How this connects to what the team is currently building" }, tags: { ...STR_ARR, description: "Searchable tags" }, connected_to: { ...STR_ARR, description: "Related concepts or other finding titles" } }, required: ["domain", "title", "summary"] } },
  { name: "carl_search_findings", description: "Search cARL's living research library by domain, tags, or keyword. Call before starting a research response to check what's already known.", inputSchema: { type: "object", properties: { domain: { ...STR, description: "Filter by research domain" }, tags: { ...STR, description: "Filter by tag (single tag)" }, search: { ...STR, description: "Keyword search across title and summary" } }, required: [] } },
  { name: "carl_curriculum", description: "Read cARL's target curriculum — the marketing + lifelong-learning syllabus cARL is working toward, with each topic's coverage status (planned / in-progress / covered). Use it to see what's covered, the blind spots (planned-but-uncovered), and what to research next.", inputSchema: { type: "object", properties: { status: { ...STR, description: "Filter by status: planned | in-progress | covered (optional)" }, domain: { ...STR, description: "Filter by domain (optional)" } }, required: [] } },
  { name: "carl_add_curriculum_topic", description: "Add a NEW topic to cARL's target curriculum — for a blind spot or a teammate/agent-requested research line that isn't covered yet. The topic starts as 'planned'; the daily study cron picks it up and synthesises findings automatically. Use this when you spot a gap and want to formally adopt it into the syllabus.", inputSchema: { type: "object", properties: { domain: { ...STR, description: "Canonical research domain label the topic belongs to" }, topic: { ...STR, description: "The specific topic or question to research" }, key_works: { ...STR_ARR, description: "Known key works/authors to anchor it (optional)" }, priority: { type: "number", description: "1 = high / urgent, 2 = medium (default), 3 = low" }, notes: { ...STR, description: "Why it matters / who asked for it (optional)" }, requested_by: { ...STR, description: "Who requested this topic — agent slug ('mo','biz','pam') or person slug ('jamie','payton','garrett'). Omit if self-generated." } }, required: ["domain", "topic"] } },
];

async function callCarl(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name === "carl_briefing") {
    const d = (await apiFetch("/api/carl/briefing", token)) as { briefing: string };
    return { text: d.briefing };
  }
  if (name === "carl_log_decision") {
    const d = (await apiFetch("/api/carl/decisions", token, { method: "POST", body: JSON.stringify({ who: a.who, summary: a.summary, decisions: a.decisions ?? [], tags: a.tags ?? [], session_type: a.session_type ?? "cowork" }) })) as { id: string };
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "carl_update_memory") {
    const d = (await apiFetch("/api/carl/memory", token, { method: "POST", body: JSON.stringify({ key: a.key, value: a.value, updated_by: a.updated_by }) })) as { key: string };
    return { text: `memory updated: ${d.key}` };
  }
  if (name === "carl_add_finding") {
    const d = (await apiFetch("/api/carl/findings", token, { method: "POST", body: JSON.stringify({ domain: a.domain, subtopic: a.subtopic || undefined, title: a.title, summary: a.summary, source: a.source || undefined, citation: a.citation || undefined, relevance: a.relevance || undefined, tags: a.tags ?? [], connected_to: a.connected_to || undefined }) })) as { id: string };
    return { text: `finding added to library (id: ${d.id}) — ${a.domain}${a.subtopic ? ` · ${a.subtopic}` : ""}: ${a.title}` };
  }
  if (name === "carl_search_findings") {
    const p = new URLSearchParams();
    if (a.domain) p.set("domain", String(a.domain));
    if (a.tags) p.set("tags", String(a.tags));
    if (a.search) p.set("search", String(a.search));
    const findings = (await apiFetch(`/api/carl/findings?${p.toString()}`, token)) as Array<{ domain: string; title: string; summary: string; relevance?: string }>;
    if (!findings.length) return { text: "no findings match that query" };
    return { text: findings.map((f) => `**${f.domain} — ${f.title}**\n${f.summary}${f.relevance ? `\n_relevance: ${f.relevance}_` : ""}`).join("\n\n") };
  }
  if (name === "carl_curriculum") {
    const p = new URLSearchParams();
    if (a.status) p.set("status", String(a.status));
    if (a.domain) p.set("domain", String(a.domain));
    const qs = p.toString();
    const topics = (await apiFetch(`/api/carl/curriculum${qs ? `?${qs}` : ""}`, token)) as Array<{ domain: string; topic: string; status: string; key_works?: string[] }>;
    if (!topics.length) return { text: "no curriculum topics match that query" };
    const byDomain: Record<string, typeof topics> = {};
    for (const t of topics) (byDomain[t.domain] ??= []).push(t);
    const mark: Record<string, string> = { covered: "✓", "in-progress": "◐", planned: "○" };
    const lines = Object.entries(byDomain).map(([domain, ts]) => {
      const rows = ts.map((t) => `  ${mark[t.status] ?? "○"} ${t.topic}${t.key_works?.length ? ` — ${t.key_works.join("; ")}` : ""}`).join("\n");
      const covered = ts.filter((t) => t.status === "covered").length;
      return `**${domain}** (${covered}/${ts.length})\n${rows}`;
    });
    return { text: lines.join("\n\n") };
  }
  if (name === "carl_add_curriculum_topic") {
    const d = (await apiFetch("/api/carl/curriculum", token, {
      method: "POST",
      body: JSON.stringify({ domain: a.domain, topic: a.topic, key_works: a.key_works ?? [], priority: a.priority ?? 2, notes: a.notes || undefined, requested_by: a.requested_by || undefined }),
    })) as { id?: string };
    return { text: `curriculum topic queued (planned, priority ${a.priority ?? 2}) — ${a.domain}: ${a.topic}${a.requested_by ? ` [requested by ${a.requested_by}]` : ""}${d.id ? ` [id: ${d.id}]` : ""}` };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

// ---- Opsy (ops) ----
// phase 1 toolset — opsy_scan_emails arrives with the phase-2 email-scan endpoint.
const OPSY_TOOLS: ToolDef[] = [
  { name: "opsy_briefing", description: "Load Opsy's full working state — current health of all platforms, open incidents, recent auto-fixes, learned patterns, and 14 days of conversation history. Call silently at session start.", inputSchema: { type: "object", properties: {}, required: [] } },
  { name: "opsy_health_check", description: "Run an on-demand health check. scope: 'tier1' (core platform — default), 'all', or a single service id (wv-site, harbour, nordic, port, creaseworks). Stores results and opens/resolves incidents on threshold breaches.", inputSchema: { type: "object", properties: { scope: { ...STR, description: "'tier1' | 'all' | service id (default 'tier1')" } }, required: [] } },
  { name: "opsy_log_incident", description: "Log a new infrastructure incident. Use for issues observed in conversation that the automated checks haven't caught.", inputSchema: { type: "object", properties: { service: { ...STR, description: "Service id or name (e.g. 'wv-site', 'notion-sync')" }, severity: { type: "string", enum: ["critical", "warning", "info"], description: "Incident severity" }, symptoms: { ...STR, description: "What is observably wrong" }, cause: { ...STR, description: "Root cause or best hypothesis (optional)" }, remediation: { ...STR, description: "What fixed it or what's being tried (optional)" }, auto_fixed: { type: "boolean", description: "True if Opsy fixed it without human action" } }, required: ["service", "severity", "symptoms"] } },
  { name: "opsy_search_incidents", description: "Search incident history. Filter by service, severity, status, or an ISO date (since). Call before diagnosing — recurring incidents carry their past remediations.", inputSchema: { type: "object", properties: { service: { ...STR, description: "Filter by service id" }, severity: { type: "string", enum: ["critical", "warning", "info"], description: "Filter by severity" }, status: { type: "string", enum: ["open", "investigating", "resolved", "monitoring"], description: "Filter by status" }, since: { ...STR, description: "ISO date — incidents opened after this (e.g. '2026-06-01')" } }, required: [] } },
  { name: "opsy_update_memory", description: "Update a key in Opsy's working state memory. Use when operational state changes — monitoring scope, known degradations, maintenance windows.", inputSchema: { type: "object", properties: { key: { ...STR, description: "Memory key (e.g. 'monitoring-status')" }, value: { ...STR, description: "New value" }, updated_by: { ...STR, description: "Who made the update (e.g. 'garrett')" } }, required: ["key", "value", "updated_by"] } },
  { name: "opsy_log_decision", description: "Log an operational decision from the current conversation — threshold changes, remediation policies, infrastructure choices.", inputSchema: { type: "object", properties: { who: { ...STR, description: "Name of the person in the conversation" }, summary: { ...STR, description: "Summary of what was discussed" }, decisions: { ...STR_ARR, description: "Specific operational decisions made" }, tags: { ...STR_ARR, description: "Relevant tags e.g. ['monitoring', 'cloudflare', 'supabase']" }, session_type: { ...STR, description: "Session type, default 'cowork'" } }, required: ["who", "summary"] } },
  { name: "opsy_scan_emails", description: "Scan the team inboxes for new infrastructure notification emails (supabase, cloudflare, vercel, github, google cloud, stripe). Classifies by service + severity, captures everything seen, and opens incidents for actionable alerts.", inputSchema: { type: "object", properties: {}, required: [] } },
];

async function callOpsy(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name === "opsy_briefing") {
    const d = (await apiFetch("/api/opsy/briefing", token)) as { briefing: string };
    return { text: d.briefing };
  }
  if (name === "opsy_health_check") {
    const d = (await apiFetch("/api/opsy/check", token, { method: "POST", body: JSON.stringify({ scope: a.scope ?? "tier1" }) })) as { checked: number; skipped?: number; results?: Array<{ service: string; status: string; response_time_ms: number | null; details?: { reason?: string } }>; incidents_opened?: string[]; incidents_resolved?: string[]; message?: string };
    if (d.message) return { text: d.message };
    const icon: Record<string, string> = { green: "🟢", amber: "🟡", red: "🔴", skipped: "⏭️" };
    const rows = (d.results ?? []).map((r) => `- ${icon[r.status] ?? "⚪"} ${r.service}: ${r.status === "skipped" ? (r.details?.reason ?? "skipped") : `${r.response_time_ms}ms`}`).join("\n");
    return { text: `checked ${d.checked} services (${d.skipped ?? 0} skipped):\n${rows}\nincidents opened: ${d.incidents_opened?.length ?? 0}, resolved: ${d.incidents_resolved?.length ?? 0}` };
  }
  if (name === "opsy_log_incident") {
    const d = (await apiFetch("/api/opsy/incidents", token, { method: "POST", body: JSON.stringify({ service: a.service, severity: a.severity, symptoms: a.symptoms, cause: a.cause || undefined, remediation: a.remediation || undefined, auto_fixed: a.auto_fixed ?? false }) })) as { id: string };
    return { text: `incident logged (id: ${d.id}) — [${a.severity}] ${a.service}: ${a.symptoms}` };
  }
  if (name === "opsy_search_incidents") {
    const p = new URLSearchParams();
    if (a.service) p.set("service", String(a.service));
    if (a.severity) p.set("severity", String(a.severity));
    if (a.status) p.set("status", String(a.status));
    if (a.since) p.set("since", String(a.since));
    const incidents = (await apiFetch(`/api/opsy/incidents?${p.toString()}`, token)) as Array<{ service: string; severity: string; status: string; symptoms: string; remediation?: string; opened_at: string }>;
    if (!incidents.length) return { text: "no incidents match that query" };
    return { text: incidents.map((i) => `**[${i.severity}] ${i.service}** (${i.status}, ${i.opened_at.slice(0, 16)} UTC)\n${i.symptoms}${i.remediation ? `\n_remediation: ${i.remediation}_` : ""}`).join("\n\n") };
  }
  if (name === "opsy_update_memory") {
    const d = (await apiFetch("/api/opsy/memory", token, { method: "POST", body: JSON.stringify({ key: a.key, value: a.value, updated_by: a.updated_by }) })) as { key: string };
    return { text: `memory updated: ${d.key}` };
  }
  if (name === "opsy_log_decision") {
    const d = (await apiFetch("/api/opsy/decisions", token, { method: "POST", body: JSON.stringify({ who: a.who, summary: a.summary, decisions: a.decisions ?? [], tags: a.tags ?? [], session_type: a.session_type ?? "cowork" }) })) as { id: string };
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "opsy_scan_emails") {
    const d = (await apiFetch("/api/opsy/email-scan", token, { method: "POST", body: "{}" })) as { accounts_scanned: string[]; accounts_unavailable: string[]; seen: number; captured: number; incidents_opened: string[]; errors: string[] };
    const lines = [
      `scanned ${d.accounts_scanned.join(", ") || "no accounts"} — ${d.seen} allowlisted emails seen, ${d.captured} newly captured, ${d.incidents_opened.length} incident(s) opened`,
    ];
    if (d.accounts_unavailable.length) lines.push(`unavailable: ${d.accounts_unavailable.join("; ")}`);
    if (d.errors.length) lines.push(`errors: ${d.errors.slice(0, 3).join("; ")}`);
    return { text: lines.join("\n") };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

// ---- Fin (CFO) ----
const FIN_TOOLS: ToolDef[] = [
  {
    name: "fin_briefing",
    description:
      "Load Fin's full financial state AND refresh live data. When called, perform these steps in order: (1) call QBO MCP tools — profit_loss_generator for current month + YTD, qbo_accounting_get_balance_sheet, qbo_accounting_get_ap_aging_summary, qbo_accounting_get_ar_aging_summary; (2) call Gusto MCP — list_payrolls for the most recent completed run; (3) search Gmail for financial emails in last 7 days (bills, invoices, tax notices, TaxDome messages, ADP alerts); (4) call fin_store_snapshot with all collected data; (5) fetch /api/fin/briefing to get open items + upcoming deadlines + recent decisions; (6) return a structured summary: cash position, month P&L, AP/AR snapshot, last payroll, and action-required items sorted by urgency. If QBO or Gusto MCPs are unavailable, note which are missing and return cached snapshot data from /api/fin/briefing instead.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "fin_store_snapshot",
    description:
      "Persist financial snapshots collected during fin_briefing. Call after fetching QBO + Gusto data. Each key in the payload maps to a snapshot_type: p_and_l, balance_sheet, ap_aging, ar_aging, payroll. Include period_label (e.g. 'June 2026') and fetched_at (ISO timestamp).",
    inputSchema: {
      type: "object",
      properties: {
        p_and_l: { type: "object", description: "QBO P&L data (profit_loss_generator response)" },
        balance_sheet: { type: "object", description: "QBO balance sheet data" },
        ap_aging: { type: "object", description: "QBO AP aging summary" },
        ar_aging: { type: "object", description: "QBO AR aging summary" },
        payroll: { type: "object", description: "Gusto most recent payroll run" },
        period_label: { ...STR, description: "Human-readable period label (e.g. 'June 2026')" },
        fetched_at: { ...STR, description: "ISO timestamp when data was fetched" },
      },
      required: [],
    },
  },
  {
    name: "fin_log_item",
    description:
      "Log a financial action item — a bill, invoice, tax notice, deadline, bank alert, TaxDome message, renewal, or other item that requires garrett's attention.",
    inputSchema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["bill", "invoice", "tax_notice", "deadline", "bank_alert", "taxdome_message", "renewal", "other"], description: "Item type" },
        title: { ...STR, description: "Clear description of the item" },
        source: { ...STR, description: "Where it came from (e.g. 'gmail', 'QBO', 'ADP')" },
        amount_cents: { type: "number", description: "Amount in cents (optional)" },
        due_date: { ...STR, description: "Due date YYYY-MM-DD (optional)" },
        notes: { ...STR, description: "Additional context (optional)" },
      },
      required: ["type", "title"],
    },
  },
  {
    name: "fin_log_decision",
    description:
      "Log a financial decision from the current conversation — a payment authorised, a tax strategy confirmed, a subscription cancelled, a rollover decision made.",
    inputSchema: {
      type: "object",
      properties: {
        decision: { ...STR, description: "The decision made" },
        context: { ...STR, description: "Why this decision was made (optional)" },
        amount_cents: { type: "number", description: "Dollar amount involved in cents (optional)" },
        category: { ...STR, description: "Category (e.g. 'tax', 'payroll', 'subscription', 'retirement')" },
        logged_by: { ...STR, description: "Who made the decision (default: garrett)" },
      },
      required: ["decision"],
    },
  },
  {
    name: "fin_update_memory",
    description:
      "Update a key in Fin's working state memory. Use when financial state changes — adviser notes, open items status, pending deadlines resolved.",
    inputSchema: {
      type: "object",
      properties: {
        key: { ...STR, description: "Memory key (e.g. 'open-items-note')" },
        value: { ...STR, description: "New value" },
        updated_by: { ...STR, description: "Who made the update (e.g. 'garrett')" },
      },
      required: ["key", "value", "updated_by"],
    },
  },
];

async function callFin(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name === "fin_briefing") {
    const d = (await apiFetch("/api/fin/briefing", token)) as {
      snapshots: Record<string, unknown>;
      open_items: Array<{ title: string; type: string; due_date?: string | null; amount_cents?: number | null }>;
      upcoming_deadlines: Array<{ vendor: string; description: string; next_expected?: string | null }>;
      recent_decisions: Array<{ decision: string; created_at: string }>;
      last_fetched_at: string | null;
      open_items_count: number;
    };
    const lines: string[] = [];
    lines.push(`# Fin briefing (cached — last fetched: ${d.last_fetched_at?.slice(0, 16) ?? "never"} UTC)`);
    lines.push("_run fin_briefing in cowork with QBO + Gusto MCPs connected for live data_");
    lines.push("");
    lines.push(`## action required (${d.open_items_count} open)`);
    if (!d.open_items.length) lines.push("_none — all clear_");
    for (const i of d.open_items.slice(0, 10)) {
      const due = i.due_date ? ` · due ${i.due_date}` : "";
      const amt = i.amount_cents ? ` · $${(i.amount_cents / 100).toFixed(2)}` : "";
      lines.push(`- **[${i.type}]** ${i.title}${due}${amt}`);
    }
    lines.push("");
    lines.push("## upcoming 30 days");
    if (!d.upcoming_deadlines.length) lines.push("_nothing scheduled_");
    for (const p of d.upcoming_deadlines.slice(0, 8)) {
      lines.push(`- **${p.vendor}** — ${p.description}${p.next_expected ? ` (${p.next_expected})` : ""}`);
    }
    lines.push("");
    lines.push("## recent decisions");
    if (!d.recent_decisions.length) lines.push("_none logged yet_");
    for (const dec of d.recent_decisions.slice(0, 5)) {
      lines.push(`- ${dec.created_at.slice(0, 10)}: ${dec.decision}`);
    }
    return { text: lines.join("\n") };
  }
  if (name === "fin_store_snapshot") {
    const payload: Record<string, unknown> = {};
    for (const k of ["p_and_l", "balance_sheet", "ap_aging", "ar_aging", "payroll", "period_label", "fetched_at"]) {
      if (a[k] !== undefined) payload[k] = a[k];
    }
    const d = (await apiFetch("/api/fin/briefing", token, { method: "POST", body: JSON.stringify(payload) })) as { upserted: string[]; count: number };
    return { text: `snapshots stored: ${d.upserted.join(", ")} (${d.count} total)` };
  }
  if (name === "fin_log_item") {
    const d = (await apiFetch("/api/fin/items", token, {
      method: "POST",
      body: JSON.stringify({ type: a.type, title: a.title, source: a.source || undefined, amount_cents: a.amount_cents || undefined, due_date: a.due_date || undefined, notes: a.notes || undefined }),
    })) as { id: string; title: string; type: string };
    return { text: `item logged (id: ${d.id}) — [${d.type}] ${d.title}` };
  }
  if (name === "fin_log_decision") {
    const d = (await apiFetch("/api/fin/decisions", token, {
      method: "POST",
      body: JSON.stringify({ decision: a.decision, context: a.context || undefined, amount_cents: a.amount_cents || undefined, category: a.category || undefined, logged_by: a.logged_by || "garrett" }),
    })) as { id: string };
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "fin_update_memory") {
    const d = (await apiFetch("/api/fin/memory", token, { method: "POST", body: JSON.stringify({ key: a.key, value: a.value, updated_by: a.updated_by }) })) as { key: string };
    return { text: `memory updated: ${d.key}` };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

// ---- Biz (business development) ----
const BIZ_TOOLS: ToolDef[] = [
  {
    name: "biz_briefing",
    description:
      "Load Biz's full business-development state: the live RFP pipeline (active opportunities with fit, value, status, deadlines from the RFP Lighthouse), raw pipeline value, bid deadlines in the next 30 days, the count of available upgrades from the roadmap, and recent BD decisions + working memory. Call silently at session start. If there are available upgrades, mention the count and offer to list them (biz_roadmap).",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "biz_roadmap",
    description:
      "List the Biz feature roadmap (mirror of docs/biz/feature-catalog.md). Use to answer 'what upgrades are available?' or to look up a feature by id. Filter by status: 'available' (not yet built — planned + backlog), 'planned', 'backlog', or 'shipped'. Default shows available upgrades.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["available", "planned", "backlog", "shipped"], description: "Which roadmap slice to return (default 'available')" },
      },
      required: [],
    },
  },
  {
    name: "biz_log_decision",
    description:
      "Log a business-development decision from the current conversation — a go/no-go call, a decision to pursue or submit, a QC verdict, or a bid outcome. Call when the decision is made, not at the end.",
    inputSchema: {
      type: "object",
      properties: {
        decision: { ...STR, description: "The decision made" },
        context: { ...STR, description: "Why this decision was made (optional)" },
        category: { ...STR, description: "Category, e.g. 'go-no-go','pursue','submit','outcome','qc' (optional)" },
        rfp_id: { ...STR, description: "rfp_opportunities.notion_page_id this relates to (optional)" },
        logged_by: { ...STR, description: "Who made the decision (default: garrett)" },
      },
      required: ["decision"],
    },
  },
  {
    name: "biz_update_memory",
    description:
      "Update a key in Biz's working state memory. Use when BD context changes — pipeline priorities, a funder relationship note, an open QC concern.",
    inputSchema: {
      type: "object",
      properties: {
        key: { ...STR, description: "Memory key (e.g. 'pipeline-note')" },
        value: { ...STR, description: "New value" },
        updated_by: { ...STR, description: "Who made the update (e.g. 'garrett')" },
      },
      required: ["key", "value", "updated_by"],
    },
  },
  {
    name: "biz_qc_review",
    description:
      "Run a QC review on a drafted bid (a 'version two' second look). Returns the structured QC inputs for the opportunity — materials checklist, requirements, CV roster + currency, submission logistics (due date + timezone, TOR, channel) — plus a gate-by-gate recipe to execute. Use after the RFP Lighthouse has drafted a bundle, before it goes to Garrett + Maria. Pass the rfp_id (rfp_opportunities.notion_page_id). After running the gates and producing the report (and regenerating a v2 locally if needed), log the verdict with biz_log_decision and, when review-ready, call biz_request_review.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: { ...STR, description: "rfp_opportunities.notion_page_id of the bid to QC" },
      },
      required: ["rfp_id"],
    },
  },
  {
    name: "biz_request_review",
    description:
      "DM Garrett + Maria (the default reviewers) on Slack that a bid is review-ready, so they can get eyes on it in time. Call once a QC pass is done and the bundle is ready for human review. Translate the deadline into Pacific time in due_local so the real cutoff is obvious.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: { ...STR, description: "rfp_opportunities.notion_page_id (optional, for logging)" },
        name: { ...STR, description: "Opportunity name" },
        summary: { ...STR, description: "1–3 line summary: fit, what's ready, any open flags from QC" },
        due_date: { ...STR, description: "Bid due date YYYY-MM-DD (optional)" },
        due_local: { ...STR, description: "Deadline phrased across timezones, e.g. '28 Jun 17:00 EAT = 07:00 PT' (optional, preferred)" },
        review_url: { ...STR, description: "Link to the drafted bundle / Notion doc (optional)" },
        reviewers: { ...STR_ARR, description: "Override reviewer emails (optional; defaults to Garrett + Maria)" },
      },
      required: ["name", "summary"],
    },
  },
  {
    name: "biz_go_no_go",
    description:
      "Assess whether to pursue an opportunity. Returns the scoring inputs — opportunity facts, eligibility requirements, fit, value, days-to-deadline, a formula win-probability, and any existing decision — plus the scorecard recipe (eligibility pass/fail, then weighted fit/capacity/strategic/win-likelihood/economics → verdict bands). Pass rfp_id. After scoring, record the call with biz_set_bid_decision.",
    inputSchema: {
      type: "object",
      properties: { rfp_id: { ...STR, description: "rfp_opportunities.notion_page_id to assess" } },
      required: ["rfp_id"],
    },
  },
  {
    name: "biz_set_bid_decision",
    description:
      "Record a go/no-go verdict on the canonical pipeline. Writes bid_decision + score + reason AND moves the card off radar by default — bid → pursuing, no-bid → no-go (deferred stays put). Pass advance_status:false to record without moving. Call after biz_go_no_go scoring.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: { ...STR, description: "rfp_opportunities.notion_page_id" },
        decision: { type: "string", enum: ["bid", "no-bid", "deferred"], description: "The verdict" },
        score: { type: "number", description: "Weighted scorecard total 0–100 (optional)" },
        reason: { ...STR, description: "One- or two-line rationale" },
        advance_status: { type: "boolean", description: "Default true: move the card (bid→pursuing, no-bid→no-go). Set false to record only." },
      },
      required: ["rfp_id", "decision"],
    },
  },
  {
    name: "biz_list",
    description:
      "List opportunities (with their rfp_ids) so you can iterate a kanban column. status: a stage (radar|reviewing|pursuing|interviewing|submitted|won|lost|no-go), 'active' (all non-terminal), or 'all'. Use this to process a whole column — e.g. biz_list('radar') then biz_go_no_go on each.",
    inputSchema: {
      type: "object",
      properties: {
        status: { ...STR, description: "Stage name, 'active', or 'all' (default 'active')" },
      },
      required: [],
    },
  },
  {
    name: "biz_log_outcome",
    description:
      "Close a bid (won / lost / no-go) with a structured debrief — sets the opportunity status and the what-worked / what-fell-flat / client-feedback / lessons fields, and logs it. This feeds the rfp-postmortem-to-library skill, so capture concrete, reusable lessons.",
    inputSchema: {
      type: "object",
      properties: {
        rfp_id: { ...STR, description: "rfp_opportunities.notion_page_id" },
        outcome: { type: "string", enum: ["won", "lost", "no-go"], description: "Final outcome" },
        what_worked: { ...STR, description: "What worked (optional)" },
        what_fell_flat: { ...STR, description: "What fell flat (optional)" },
        client_feedback: { ...STR, description: "Any client/funder feedback (optional)" },
        lessons: { ...STR, description: "Lessons for next time — concrete + reusable (optional)" },
      },
      required: ["rfp_id", "outcome"],
    },
  },
  {
    name: "biz_request_research",
    description:
      "Ask cARL to research a topic relevant to business development — sector intelligence, funder behaviour, outcomes frameworks, bid strategy, RFP analysis patterns. cARL queues it as priority 1 and delivers findings at the next daily run. Use when you need theoretical or evidence-based grounding before a bid decision, proposal, or strategy call.",
    inputSchema: {
      type: "object",
      properties: {
        domain: { ...STR, description: "Canonical cARL domain label this research belongs to (e.g. 'mhpss & mission', 'mo · strategy', 'learning design & UDL')" },
        topic: { ...STR, description: "Specific topic or question to research (e.g. 'outcomes-based contracting in education sector', 'impact measurement frameworks for MHPSS funders')" },
        context: { ...STR, description: "Why this is needed — the bid, decision, or question driving the request (optional but helps cARL prioritise)" },
        key_works: { ...STR_ARR, description: "Known papers, authors, or frameworks to anchor the search (optional)" },
      },
      required: ["domain", "topic"],
    },
  },
];

// the go/no-go scorecard recipe the Cowork agent applies after biz_go_no_go returns the facts
const GONOGO_RECIPE = [
  "",
  "---",
  "## score the go/no-go",
  "1. **eligibility (pass/fail)** — are we actually eligible? entity type, registrations, and any mandatory eligibility requirement above. if any hard requirement fails → **no-bid**, stop here.",
  "2. **weighted scorecard (0–100)** — fit (the win-probability + wv fit are a starting point, not the answer), capacity (do we have the team + bandwidth given days-to-deadline and current pipeline load?), strategic value (sector / funder relationship / portfolio fit), win-likelihood (competition, incumbency, our differentiation), economics (value vs effort + a defensible margin — pull rates from Fin via fin_briefing if it's close).",
  "3. **verdict bands** — <40 **no-bid** · 40–70 **defer** (name the gap that would change it) · >70 **bid**.",
  "",
  "then: give garrett a clear bid · no-bid · defer with a one-line rationale, and record it with `biz_set_bid_decision`. on a **bid**, hand off: push the deadline + any contributor tasks to PaM (`pam_create_commitment`), and queue the QC pass (`biz_qc_review`) once a draft exists.",
].join("\n");

// the gate-by-gate recipe the Cowork agent executes after biz_qc_review returns the facts
const QC_RECIPE = [
  "",
  "---",
  "## run the QC gates (your second look → version two)",
  "1. **materials completeness** — every baseline doc present? every submission-requirement (forms, registrations) confirmed? flag anything missing or unconfirmed.",
  "2. **CV quality vs the canonical flow** — the named team (Garrett, Lamis, Maria always; Payton substantive; James if curriculum-heavy) must be in the bundle's CVs. check the roster above for who's current vs stale. pull the bundle's CVs and flag any copy-pasted / identical experience entries across members — each CV must be role-specific and differentiated.",
  "3. **consistency / conflict** — pull the drafted bundle locally and run the `align-narrative-across-deliverables` skill. also cross-check the deal-page facts (name, value, geography, due date) against the bundle and the TOR snapshot. flag contradictions (e.g. '60 countries' vs 'Asia-Pacific', '8 weeks' vs '7 months').",
  "4. **submission logistics** — confirm the due date + funder timezone, translate it to Pacific so the real cutoff is explicit, confirm the submission channel (portal vs email) from the opportunity/TOR links, and confirm the materials checklist is complete. portal-registration status is a manual confirm for now.",
  "5. **quality** — check each section against w.v's minimums + specificity; use `inject-evidence-from-port` to strengthen thin or generic sections.",
  "6. **go/no-go** — synthesise a verdict (go · fix-then-go · no-go) with a short rationale. log it with `biz_log_decision` (category 'qc' or 'go-no-go').",
  "",
  "then: produce a concise QC report (gate-by-gate, with concrete fixes). if fixes are substantive, regenerate a **v2 bundle locally** (use `rfp-proposal-from-tor` / targeted edits) — do NOT write to Notion. when it's review-ready, call `biz_request_review` to DM Garrett + Maria with the deadline translated across timezones.",
].join("\n");

async function callBiz(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name === "biz_briefing") {
    const d = (await apiFetch("/api/biz/briefing", token)) as {
      pipeline: Array<{ name: string; status: string; fit: string; value: number | null; due_date: string | null; proposal_status: string | null }>;
      pipeline_count: number;
      pipeline_value: number;
      by_status: Record<string, number>;
      upcoming_deadlines: Array<{ id: string; name: string; due_date: string | null; status: string; fit: string }>;
      upgrades_available: Array<{ feature_id: string; title: string; priority: string | null }>;
      upgrades_available_count: number;
      recent_decisions: Array<{ decision: string; created_at: string }>;
    };
    const lines: string[] = [];
    const fmtUsd = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
    lines.push(`# Biz briefing`);
    const stages = Object.entries(d.by_status).map(([s, n]) => `${s} ${n}`).join(" · ");
    lines.push(`## pipeline — ${d.pipeline_count} active · ${fmtUsd(d.pipeline_value)} raw value`);
    if (stages) lines.push(`_${stages}_`);
    lines.push("");
    lines.push(`## bid deadlines — next 30 days (${d.upcoming_deadlines.length})`);
    if (!d.upcoming_deadlines.length) lines.push("_nothing due_");
    for (const o of d.upcoming_deadlines.slice(0, 10)) {
      lines.push(`- **${o.name}** — due ${o.due_date} · ${o.status} · ${o.fit} · \`${o.id}\``);
    }
    lines.push("");
    lines.push(`## upgrades available — ${d.upgrades_available_count}`);
    if (!d.upgrades_available_count) lines.push("_all shipped_");
    else {
      for (const u of d.upgrades_available.slice(0, 5)) {
        lines.push(`- **${u.feature_id}** ${u.title}${u.priority ? ` (${u.priority})` : ""}`);
      }
      if (d.upgrades_available_count > 5) lines.push(`_…and ${d.upgrades_available_count - 5} more — ask "what upgrades are available?"_`);
    }
    lines.push("");
    lines.push("## recent decisions");
    if (!d.recent_decisions.length) lines.push("_none logged yet_");
    for (const dec of d.recent_decisions.slice(0, 5)) {
      lines.push(`- ${dec.created_at.slice(0, 10)}: ${dec.decision}`);
    }
    return { text: lines.join("\n") };
  }
  if (name === "biz_roadmap") {
    const slice = (a.status as string) || "available";
    const path = slice === "available" ? "/api/biz/roadmap?available=1" : `/api/biz/roadmap?status=${encodeURIComponent(slice)}`;
    const items = (await apiFetch(path, token)) as Array<{ feature_id: string; title: string; status: string; priority: string | null; surface: string | null; fixes: string | null }>;
    const lines: string[] = [`# Biz roadmap — ${slice} (${items.length})`];
    for (const i of items) {
      lines.push(`- **${i.feature_id}** ${i.title}${i.priority ? ` · ${i.priority}` : ""}${i.surface ? ` · ${i.surface}` : ""}${i.fixes && i.fixes !== "-" ? ` — fixes: ${i.fixes}` : ""}`);
    }
    return { text: lines.join("\n") };
  }
  if (name === "biz_log_decision") {
    const d = (await apiFetch("/api/biz/decisions", token, {
      method: "POST",
      body: JSON.stringify({ decision: a.decision, context: a.context || undefined, category: a.category || undefined, rfp_id: a.rfp_id || undefined, logged_by: a.logged_by || "garrett" }),
    })) as { id: string };
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "biz_update_memory") {
    const d = (await apiFetch("/api/biz/memory", token, { method: "POST", body: JSON.stringify({ key: a.key, value: a.value, updated_by: a.updated_by }) })) as { key: string };
    return { text: `memory updated: ${d.key}` };
  }
  if (name === "biz_qc_review") {
    if (!a.rfp_id) return { text: "rfp_id is required", isError: true };
    const q = (await apiFetch(`/api/biz/qc/${encodeURIComponent(String(a.rfp_id))}`, token)) as {
      opportunity: { name: string; status: string; type: string; fit: string; estimated_value: number | null; due_date: string | null; deadline_timezone: string | null; opportunity_url: string | null; rfp_document_url: string | null; tor_snapshot: string | null };
      materials_checklist: Array<{ label: string; present: boolean | null; basis: string }>;
      requirements: { total: number; by_kind: Record<string, number>; unapproved_required_deliverables: number };
      readiness: { ready: boolean; reason: string | null };
      cvs: Array<{ name: string; current: boolean; last_verified_at: string | null }>;
    };
    const o = q.opportunity;
    const lines: string[] = [];
    lines.push(`# QC review — ${o.name}`);
    lines.push(`${o.type} · ${o.status} · fit: ${o.fit}${o.estimated_value ? ` · $${Math.round(o.estimated_value).toLocaleString("en-US")}` : ""}`);
    lines.push(`due: ${o.due_date ?? "—"}${o.deadline_timezone ? ` (${o.deadline_timezone})` : " (timezone not set — confirm)"}`);
    if (o.rfp_document_url) lines.push(`TOR: ${o.rfp_document_url}`);
    if (o.opportunity_url) lines.push(`source: ${o.opportunity_url}`);
    lines.push("");
    lines.push("## materials checklist");
    for (const m of q.materials_checklist) {
      const mark = m.present === true ? "✅" : m.present === false ? "❌ missing" : "❓ confirm manually";
      lines.push(`- ${mark} — ${m.label}${m.basis === "submission-requirement" ? " _(funder requirement)_" : ""}`);
    }
    lines.push("");
    lines.push(`## requirements — ${q.requirements.total} extracted`);
    lines.push(Object.entries(q.requirements.by_kind).map(([k, n]) => `${k}: ${n}`).join(" · ") || "_none extracted_");
    if (q.requirements.unapproved_required_deliverables > 0) lines.push(`⚠️ ${q.requirements.unapproved_required_deliverables} required deliverable(s) not yet approved`);
    lines.push("");
    lines.push("## CVs (canonical roster)");
    if (!q.cvs.length) lines.push("_no CVs in collective_cv_");
    for (const c of q.cvs) lines.push(`- ${c.current ? "🟢 current" : "🔴 stale"} — ${c.name}${c.last_verified_at ? ` (verified ${c.last_verified_at.slice(0, 10)})` : " (never verified)"}`);
    lines.push("");
    lines.push(`## readiness: ${q.readiness.ready ? "✅ ready" : `⚠️ ${q.readiness.reason}`}`);
    lines.push(QC_RECIPE);
    return { text: lines.join("\n") };
  }
  if (name === "biz_request_review") {
    const d = (await apiFetch("/api/biz/notify-review", token, {
      method: "POST",
      body: JSON.stringify({ rfp_id: a.rfp_id || undefined, name: a.name, summary: a.summary, due_date: a.due_date || undefined, due_local: a.due_local || undefined, review_url: a.review_url || undefined, reviewers: a.reviewers || undefined }),
    })) as { sent: string[]; failed: string[] };
    const failed = d.failed.length ? ` · failed: ${d.failed.join(", ")}` : "";
    return { text: `review request DM'd to ${d.sent.join(", ") || "no one"}${failed}` };
  }
  if (name === "biz_go_no_go") {
    if (!a.rfp_id) return { text: "rfp_id is required", isError: true };
    const g = (await apiFetch(`/api/biz/go-no-go/${encodeURIComponent(String(a.rfp_id))}`, token)) as {
      name: string; status: string; type: string; fit: string; estimated_value: number | null; due_date: string | null; days_to_deadline: number | null;
      service_match: string[]; geography: string[]; win_probability: number;
      eligibility: Array<{ label: string; required: boolean }>;
      current_decision: { decision: string | null; score: number | null; reason: string | null };
    };
    const lines: string[] = [];
    lines.push(`# go/no-go — ${g.name}`);
    lines.push(`${g.type} · ${g.status} · fit: ${g.fit}${g.estimated_value ? ` · $${Math.round(g.estimated_value).toLocaleString("en-US")}` : ""}`);
    lines.push(`deadline: ${g.due_date ?? "—"}${g.days_to_deadline != null ? ` (${g.days_to_deadline}d out)` : ""} · formula win-probability: **${g.win_probability}%**`);
    if (g.service_match.length) lines.push(`service match: ${g.service_match.join(", ")}`);
    if (g.geography.length) lines.push(`geography: ${g.geography.join(", ")}`);
    lines.push("");
    lines.push("## eligibility requirements");
    if (!g.eligibility.length) lines.push("_none extracted — confirm eligibility from the TOR_");
    for (const e of g.eligibility) lines.push(`- ${e.required ? "**(mandatory)** " : ""}${e.label}`);
    if (g.current_decision.decision) lines.push(`\n_current decision on file: **${g.current_decision.decision}**${g.current_decision.score != null ? ` (${g.current_decision.score}/100)` : ""}${g.current_decision.reason ? ` — ${g.current_decision.reason}` : ""}_`);
    lines.push(GONOGO_RECIPE);
    return { text: lines.join("\n") };
  }
  if (name === "biz_set_bid_decision") {
    const d = (await apiFetch("/api/biz/bid-decision", token, {
      method: "POST",
      body: JSON.stringify({ rfp_id: a.rfp_id, decision: a.decision, score: a.score, reason: a.reason || undefined, advance_status: a.advance_status }),
    })) as { decision: string; score: number | null; moved_to: string | null };
    return { text: `recorded: ${d.decision}${d.score != null ? ` (${d.score}/100)` : ""}${d.moved_to ? ` → moved to ${d.moved_to}` : ""}` };
  }
  if (name === "biz_list") {
    const status = (a.status as string) || "active";
    const d = (await apiFetch(`/api/biz/opportunities?status=${encodeURIComponent(status)}`, token)) as {
      count: number; items: Array<{ id: string; name: string; status: string; fit: string; value: number | null; due_date: string | null }>;
    };
    const lines: string[] = [`# opportunities — ${status} (${d.count})`];
    for (const o of d.items) {
      lines.push(`- **${o.name}** — ${o.status} · ${o.fit}${o.value ? ` · $${Math.round(o.value).toLocaleString("en-US")}` : ""}${o.due_date ? ` · due ${o.due_date}` : ""}\n  \`rfp_id: ${o.id}\``);
    }
    return { text: lines.join("\n") };
  }
  if (name === "biz_log_outcome") {
    const d = (await apiFetch("/api/biz/outcome", token, {
      method: "POST",
      body: JSON.stringify({ rfp_id: a.rfp_id, outcome: a.outcome, what_worked: a.what_worked, what_fell_flat: a.what_fell_flat, client_feedback: a.client_feedback, lessons: a.lessons }),
    })) as { outcome: string };
    return { text: `outcome recorded: ${d.outcome} — debrief saved. consider running the rfp-postmortem-to-library skill to bank the lessons.` };
  }
  if (name === "biz_request_research") {
    const d = (await apiFetch("/api/carl/curriculum", token, {
      method: "POST",
      body: JSON.stringify({ domain: a.domain, topic: a.topic, key_works: a.key_works ?? [], priority: 1, notes: a.context || undefined, requested_by: "biz" }),
    })) as { id?: string };
    return { text: `research request queued for cARL (priority 1) — ${a.domain}: ${a.topic}. cARL will synthesise findings at the next daily run and post a digest to #canon.${d.id ? ` [id: ${d.id}]` : ""}` };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

const AGENTS: Record<string, AgentSpec> = {
  mo: { serverName: "mo-memory", title: "Mo (CMO) memory", instructions: "Mo is winded.vertigo's chief marketing officer. Call cmo_briefing silently at session start to load persistent memory; log decisions as they're made.", tools: MO_TOOLS, call: callMo },
  pam: { serverName: "pam-memory", title: "PaM memory", instructions: "PaM is winded.vertigo's project + momentum manager. Call pam_briefing silently at session start; create/update commitments and log decisions as they happen.", tools: PAM_TOOLS, call: callPam },
  carl: { serverName: "carl-memory", title: "cARL memory", instructions: "cARL is winded.vertigo's research agent. Call carl_briefing at session start; search the library before researching, and add findings as they're synthesised.", tools: CARL_TOOLS, call: callCarl },
  opsy: { serverName: "opsy-memory", title: "Opsy (ops) memory", instructions: "Opsy is winded.vertigo's operations + systems intelligence agent. Call opsy_briefing silently at session start; run health checks on demand, search incident history before diagnosing, and log incidents and decisions as they happen.", tools: OPSY_TOOLS, call: callOpsy },
  fin: { serverName: "fin-memory", title: "Fin (CFO) memory", instructions: "Fin is winded.vertigo's CFO agent — personal + business finances for garrett. Call fin_briefing silently at session start (it orchestrates QBO + Gusto + Gmail MCPs and returns a live financial summary); log items and decisions as they surface.", tools: FIN_TOOLS, call: callFin },
  biz: { serverName: "biz-memory", title: "Biz (BD) memory", instructions: "Biz is winded.vertigo's business-development agent — it drives the RFP Lighthouse (intake, fit, proposals, QC). Call biz_briefing silently at session start (live pipeline + bid deadlines + available upgrades); log go/no-go and bid decisions as they're made, and surface available roadmap upgrades when relevant.", tools: BIZ_TOOLS, call: callBiz },
};
AGENTS.cmo = AGENTS.mo; // alias

// ── combined connector: all five agents behind one URL (the OAuth resource) ──
// Cowork adds ONE custom connector (/api/mcp/agents/all) and gets all tools.
// Each call routes to the right agent by tool-name prefix.
async function callAll(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name.startsWith("cmo_")) return callMo(name, a, token);
  if (name.startsWith("pam_")) return callPam(name, a, token);
  if (name.startsWith("carl_")) return callCarl(name, a, token);
  if (name.startsWith("opsy_")) return callOpsy(name, a, token);
  if (name.startsWith("fin_")) return callFin(name, a, token);
  if (name.startsWith("biz_")) return callBiz(name, a, token);
  return { text: `unknown tool: ${name}`, isError: true };
}
AGENTS.all = {
  serverName: "wv-agents",
  title: "winded.vertigo agents",
  instructions:
    "Mo, PaM, cARL, Opsy, Fin, and Biz in one connector. cmo_* = marketing (Mo), pam_* = projects/commitments (PaM), carl_* = research (cARL), opsy_* = infrastructure ops (Opsy), fin_* = CFO / finances (Fin), biz_* = business development / RFPs (Biz). Call the *_briefing tools at session start to load shared memory.",
  tools: [...MO_TOOLS, ...PAM_TOOLS, ...CARL_TOOLS, ...OPSY_TOOLS, ...FIN_TOOLS, ...BIZ_TOOLS],
  call: callAll,
};

// ── JSON-RPC plumbing (mirrors /api/mcp/v1) ──────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}
type JsonRpcResponse =
  | { jsonrpc: "2.0"; id: string | number | null; result: unknown }
  | { jsonrpc: "2.0"; id: string | number | null; error: { code: number; message: string } };

const ERR = { PARSE: -32700, METHOD_NOT_FOUND: -32601, INTERNAL: -32603 } as const;

/**
 * Accept EITHER the static CMO_API_TOKEN (Claude Code plugins) OR a valid OAuth
 * access token (Cowork sign-in). Returns the token to forward to the internal
 * /api/{agent}/* API — always the static token, since that API only knows it —
 * or null if unauthorized.
 */
async function authorize(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const provided = header.slice(7);
  if (!provided) return null;

  const staticTok = process.env.CMO_API_TOKEN;
  // static token — constant-time compare
  if (staticTok && provided.length === staticTok.length) {
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) mismatch |= provided.charCodeAt(i) ^ staticTok.charCodeAt(i);
    if (mismatch === 0) return staticTok;
  }
  // OAuth access token (JWT) — verify signature, audience, allowlisted user
  try {
    const claims = await verifyJwt(provided, oauthSecret());
    if (claims && claims.type === "access" && claims.aud === RESOURCE && isAllowedEmail(claims.sub)) {
      return staticTok ?? "";
    }
  } catch {
    /* not our JWT */
  }
  return null;
}

/** 401 carrying the RFC 9728 challenge so MCP clients discover the OAuth flow. */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: "unauthorized" },
    {
      status: 401,
      headers: { "WWW-Authenticate": `Bearer resource_metadata="${PROTECTED_RESOURCE_METADATA_URL}"` },
    },
  );
}

async function dispatch(spec: AgentSpec, rpc: JsonRpcRequest, token: string): Promise<JsonRpcResponse | null> {
  const isNotification = rpc.id === undefined || rpc.id === null;
  const id = rpc.id ?? null;
  try {
    switch (rpc.method) {
      case "initialize":
        return { jsonrpc: "2.0", id, result: { protocolVersion: "2025-06-18", capabilities: { tools: { listChanged: false } }, serverInfo: { name: spec.serverName, version: "1.0.0", title: spec.title }, instructions: spec.instructions } };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: spec.tools } };
      case "tools/call": {
        const params = (rpc.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        const r = await spec.call(params.name ?? "", params.arguments ?? {}, token);
        return { jsonrpc: "2.0", id, result: { isError: r.isError ?? false, content: [{ type: "text", text: r.text }] } };
      }
      case "notifications/initialized":
      case "notifications/cancelled":
      case "ping":
        if (isNotification) return null;
        return { jsonrpc: "2.0", id, result: {} };
      default:
        return { jsonrpc: "2.0", id, error: { code: ERR.METHOD_NOT_FOUND, message: `method '${rpc.method}' not implemented` } };
    }
  } catch (err) {
    return { jsonrpc: "2.0", id, error: { code: ERR.INTERNAL, message: err instanceof Error ? err.message : "unknown error" } };
  }
}

function resolveAgent(agent: string): AgentSpec | null {
  return AGENTS[agent?.toLowerCase()] ?? null;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ agent: string }> }): Promise<NextResponse> {
  const { agent } = await ctx.params;
  const spec = resolveAgent(agent);
  if (!spec) return NextResponse.json({ error: `unknown agent '${agent}'` }, { status: 404 });

  const token = await authorize(req);
  if (token === null) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ jsonrpc: "2.0", id: null, error: { code: ERR.PARSE, message: "invalid JSON" } }, { status: 400 });
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => dispatch(spec, r as JsonRpcRequest, token)));
    const nonNull = responses.filter((r): r is JsonRpcResponse => r !== null);
    if (nonNull.length === 0) return new NextResponse(null, { status: 204 });
    return NextResponse.json(nonNull);
  }

  const response = await dispatch(spec, body as JsonRpcRequest, token);
  if (response === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(response);
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ agent: string }> }): Promise<NextResponse> {
  const { agent } = await ctx.params;
  const spec = resolveAgent(agent);
  if (!spec) return NextResponse.json({ error: `unknown agent '${agent}'`, agents: Object.keys(AGENTS) }, { status: 404 });
  // Also gate GET (Streamable-HTTP clients may open a stream via GET), so the 401
  // challenge fires here too and OAuth discovery kicks off.
  const token = await authorize(req);
  if (token === null) return unauthorized();
  return NextResponse.json({
    name: spec.serverName,
    version: "1.0.0",
    protocol: "Model Context Protocol over HTTP (JSON-RPC 2.0)",
    instructions: "POST JSON-RPC requests here. Auth: Bearer <agent token> (Claude Code) or OAuth (Cowork). Methods: initialize, tools/list, tools/call.",
    tools_available: spec.tools.map((t) => t.name),
  });
}
