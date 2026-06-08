/**
 * POST /api/mcp/agents/[agent] — remote MCP server for the Mo / PaM / cARL
 * memory layer, over HTTP (JSON-RPC 2.0). This is the Cowork-compatible twin of
 * the local stdio servers in docs/plugins/* : Claude Desktop / Cowork runs in a
 * VM and cannot launch local `node index.js`, so the tools must arrive as a
 * remote URL. Same tools, same backend — this route is a thin protocol shim in
 * front of the existing /api/{cmo,pam,carl}/* API (self-fetched via PORT_URL,
 * the established internal-call pattern in this app).
 *
 * agent ∈ { mo (alias cmo) | pam | carl }. Auth: Bearer CMO_API_TOKEN — the same
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
  { name: "carl_add_finding", description: "Add a synthesised finding to cARL's living research library. Call when a relevant study, framework, or insight is surfaced that connects to the team's work.", inputSchema: { type: "object", properties: { domain: { ...STR, description: "Research domain (e.g. 'threshold concepts', 'play-based learning', 'UDL')" }, title: { ...STR, description: "Clear descriptive title of the finding" }, summary: { ...STR, description: "1-3 sentence distilled insight (not raw notes)" }, source: { ...STR, description: "Author(s) and title of the source" }, citation: { ...STR, description: "Enough detail to find the source (author, year, journal/book)" }, relevance: { ...STR, description: "How this connects to what the team is currently building" }, tags: { ...STR_ARR, description: "Searchable tags" }, connected_to: { ...STR_ARR, description: "Related concepts or other finding titles" } }, required: ["domain", "title", "summary"] } },
  { name: "carl_search_findings", description: "Search cARL's living research library by domain, tags, or keyword. Call before starting a research response to check what's already known.", inputSchema: { type: "object", properties: { domain: { ...STR, description: "Filter by research domain" }, tags: { ...STR, description: "Filter by tag (single tag)" }, search: { ...STR, description: "Keyword search across title and summary" } }, required: [] } },
  { name: "carl_curriculum", description: "Read cARL's target curriculum — the marketing + lifelong-learning syllabus cARL is working toward, with each topic's coverage status (planned / in-progress / covered). Use it to see what's covered, the blind spots (planned-but-uncovered), and what to research next.", inputSchema: { type: "object", properties: { status: { ...STR, description: "Filter by status: planned | in-progress | covered (optional)" }, domain: { ...STR, description: "Filter by domain (optional)" } }, required: [] } },
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
    const d = (await apiFetch("/api/carl/findings", token, { method: "POST", body: JSON.stringify({ domain: a.domain, title: a.title, summary: a.summary, source: a.source || undefined, citation: a.citation || undefined, relevance: a.relevance || undefined, tags: a.tags ?? [], connected_to: a.connected_to || undefined }) })) as { id: string };
    return { text: `finding added to library (id: ${d.id}) — ${a.domain}: ${a.title}` };
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
  return { text: `unknown tool: ${name}`, isError: true };
}

const AGENTS: Record<string, AgentSpec> = {
  mo: { serverName: "mo-memory", title: "Mo (CMO) memory", instructions: "Mo is winded.vertigo's chief marketing officer. Call cmo_briefing silently at session start to load persistent memory; log decisions as they're made.", tools: MO_TOOLS, call: callMo },
  pam: { serverName: "pam-memory", title: "PaM memory", instructions: "PaM is winded.vertigo's project + momentum manager. Call pam_briefing silently at session start; create/update commitments and log decisions as they happen.", tools: PAM_TOOLS, call: callPam },
  carl: { serverName: "carl-memory", title: "cARL memory", instructions: "cARL is winded.vertigo's research agent. Call carl_briefing at session start; search the library before researching, and add findings as they're synthesised.", tools: CARL_TOOLS, call: callCarl },
};
AGENTS.cmo = AGENTS.mo; // alias

// ── combined connector: all three agents behind one URL (the OAuth resource) ──
// Cowork adds ONE custom connector (/api/mcp/agents/all) and gets all 14 tools.
// Each call routes to the right agent by tool-name prefix.
async function callAll(name: string, a: Record<string, unknown>, token: string): Promise<ToolResult> {
  if (name.startsWith("cmo_")) return callMo(name, a, token);
  if (name.startsWith("pam_")) return callPam(name, a, token);
  if (name.startsWith("carl_")) return callCarl(name, a, token);
  return { text: `unknown tool: ${name}`, isError: true };
}
AGENTS.all = {
  serverName: "wv-agents",
  title: "winded.vertigo agents",
  instructions:
    "Mo, PaM, and cARL in one connector. cmo_* = marketing (Mo), pam_* = projects/commitments (PaM), carl_* = research (cARL). Call the *_briefing tools at session start to load shared memory.",
  tools: [...MO_TOOLS, ...PAM_TOOLS, ...CARL_TOOLS],
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
