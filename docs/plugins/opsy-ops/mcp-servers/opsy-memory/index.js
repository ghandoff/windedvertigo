const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const API_BASE = "https://port.windedvertigo.com";
const API_TOKEN = process.env.WV_AGENT_TOKEN;
if (!API_TOKEN) {
  process.stderr.write("opsy-memory: WV_AGENT_TOKEN env var not set — add `export WV_AGENT_TOKEN=<token>` to ~/.zshrc\n");
  process.exit(1);
}

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Authorization": `Bearer ${API_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json();
}

const server = new Server(
  { name: "opsy-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "opsy_briefing",
      description: "Load Opsy's full working state — current health of all platforms, open incidents, recent auto-fixes, learned patterns, and 14 days of conversation history. Call silently at session start.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "opsy_health_check",
      description: "Run an on-demand health check. scope: 'tier1' (core platform — default), 'all', or a single service id (wv-site, harbour, nordic, port, creaseworks, …).",
      inputSchema: {
        type: "object",
        properties: {
          scope: { type: "string", description: "'tier1' | 'all' | service id (default 'tier1')" },
        },
        required: [],
      },
    },
    {
      name: "opsy_log_incident",
      description: "Log a new infrastructure incident observed in conversation that automated checks haven't caught.",
      inputSchema: {
        type: "object",
        properties: {
          service: { type: "string", description: "Service id or name (e.g. 'wv-site', 'notion-sync')" },
          severity: { type: "string", enum: ["critical", "warning", "info"], description: "Incident severity" },
          symptoms: { type: "string", description: "What is observably wrong" },
          cause: { type: "string", description: "Root cause or best hypothesis (optional)" },
          remediation: { type: "string", description: "What fixed it or what's being tried (optional)" },
          auto_fixed: { type: "boolean", description: "True if Opsy fixed it without human action" },
        },
        required: ["service", "severity", "symptoms"],
      },
    },
    {
      name: "opsy_search_incidents",
      description: "Search incident history by service, severity, status, or ISO date (since). Call before diagnosing — recurring incidents carry their past remediations.",
      inputSchema: {
        type: "object",
        properties: {
          service: { type: "string", description: "Filter by service id" },
          severity: { type: "string", enum: ["critical", "warning", "info"], description: "Filter by severity" },
          status: { type: "string", enum: ["open", "investigating", "resolved", "monitoring"], description: "Filter by status" },
          since: { type: "string", description: "ISO date — incidents opened after this (e.g. '2026-06-01')" },
        },
        required: [],
      },
    },
    {
      name: "opsy_update_memory",
      description: "Update a key in Opsy's working state memory. Use when operational state changes — monitoring scope, known degradations, maintenance windows.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'monitoring-status')" },
          value: { type: "string", description: "New value" },
          updated_by: { type: "string", description: "Who made the update (e.g. 'garrett')" },
        },
        required: ["key", "value", "updated_by"],
      },
    },
    {
      name: "opsy_log_decision",
      description: "Log an operational decision from the current conversation — threshold changes, remediation policies, infrastructure choices.",
      inputSchema: {
        type: "object",
        properties: {
          who: { type: "string", description: "Name of the person in the conversation" },
          summary: { type: "string", description: "Summary of what was discussed" },
          decisions: { type: "array", items: { type: "string" }, description: "Specific operational decisions made" },
          tags: { type: "array", items: { type: "string" }, description: "Relevant tags e.g. ['monitoring', 'cloudflare', 'supabase']" },
          session_type: { type: "string", description: "Session type, default 'cowork'" },
        },
        required: ["who", "summary"],
      },
    },
    {
      name: "opsy_scan_emails",
      description: "Scan the team inboxes for new infrastructure notification emails (supabase, cloudflare, vercel, github, google cloud, stripe). Captures everything seen and opens incidents for actionable alerts.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === "opsy_briefing") {
      const data = await apiFetch("/api/opsy/briefing");
      return { content: [{ type: "text", text: data.briefing }] };
    }

    if (name === "opsy_health_check") {
      const data = await apiFetch("/api/opsy/check", {
        method: "POST",
        body: JSON.stringify({ scope: args.scope || "tier1" }),
      });
      if (data.message) return { content: [{ type: "text", text: data.message }] };
      const icon = { green: "🟢", amber: "🟡", red: "🔴", skipped: "⏭️" };
      const rows = (data.results || [])
        .map((r) => `- ${icon[r.status] || "⚪"} ${r.service}: ${r.status === "skipped" ? ((r.details && r.details.reason) || "skipped") : `${r.response_time_ms}ms`}`)
        .join("\n");
      return {
        content: [{
          type: "text",
          text: `checked ${data.checked} services (${data.skipped || 0} skipped):\n${rows}\nincidents opened: ${(data.incidents_opened || []).length}, resolved: ${(data.incidents_resolved || []).length}`,
        }],
      };
    }

    if (name === "opsy_log_incident") {
      const data = await apiFetch("/api/opsy/incidents", {
        method: "POST",
        body: JSON.stringify({
          service: args.service,
          severity: args.severity,
          symptoms: args.symptoms,
          cause: args.cause || undefined,
          remediation: args.remediation || undefined,
          auto_fixed: args.auto_fixed || false,
        }),
      });
      return { content: [{ type: "text", text: `incident logged (id: ${data.id}) — [${args.severity}] ${args.service}: ${args.symptoms}` }] };
    }

    if (name === "opsy_search_incidents") {
      const params = new URLSearchParams();
      if (args.service) params.set("service", args.service);
      if (args.severity) params.set("severity", args.severity);
      if (args.status) params.set("status", args.status);
      if (args.since) params.set("since", args.since);
      const incidents = await apiFetch(`/api/opsy/incidents?${params.toString()}`);
      if (!incidents.length) return { content: [{ type: "text", text: "no incidents match that query" }] };
      const text = incidents
        .map((i) => `**[${i.severity}] ${i.service}** (${i.status}, ${i.opened_at.slice(0, 16)} UTC)\n${i.symptoms}${i.remediation ? `\n_remediation: ${i.remediation}_` : ""}`)
        .join("\n\n");
      return { content: [{ type: "text", text }] };
    }

    if (name === "opsy_update_memory") {
      const data = await apiFetch("/api/opsy/memory", {
        method: "POST",
        body: JSON.stringify({ key: args.key, value: args.value, updated_by: args.updated_by }),
      });
      return { content: [{ type: "text", text: `memory updated: ${data.key}` }] };
    }

    if (name === "opsy_log_decision") {
      const data = await apiFetch("/api/opsy/decisions", {
        method: "POST",
        body: JSON.stringify({
          who: args.who,
          summary: args.summary,
          decisions: args.decisions || [],
          tags: args.tags || [],
          session_type: args.session_type || "cowork",
        }),
      });
      return { content: [{ type: "text", text: `decision logged (id: ${data.id})` }] };
    }

    if (name === "opsy_scan_emails") {
      const d = await apiFetch("/api/opsy/email-scan", { method: "POST", body: "{}" });
      const lines = [
        `scanned ${(d.accounts_scanned || []).join(", ") || "no accounts"} — ${d.seen} allowlisted emails seen, ${d.captured} newly captured, ${(d.incidents_opened || []).length} incident(s) opened`,
      ];
      if ((d.accounts_unavailable || []).length) lines.push(`unavailable: ${d.accounts_unavailable.join("; ")}`);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    return { content: [{ type: "text", text: `unknown tool: ${name}` }], isError: true };
  } catch (err) {
    return { content: [{ type: "text", text: `error: ${err.message}` }], isError: true };
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`opsy-memory MCP server error: ${err.message}\n`);
  process.exit(1);
});
