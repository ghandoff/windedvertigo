const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const API_BASE = "https://port.windedvertigo.com";
const API_TOKEN = process.env.WV_AGENT_TOKEN;
if (!API_TOKEN) {
  process.stderr.write("biz-memory: WV_AGENT_TOKEN env var not set — add `export WV_AGENT_TOKEN=<token>` to ~/.zshrc\n");
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
  { name: "biz-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "biz_briefing",
      description:
        "Load Biz's full business-development state: live RFP pipeline (active opportunities with fit, value, status, deadlines), raw pipeline value, bid deadlines in the next 30 days, available roadmap upgrades, and recent BD decisions + working memory. Call silently at session start. If upgrades are available, mention the count and offer to list them.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "biz_roadmap",
      description:
        "List the Biz feature roadmap (mirror of docs/biz/feature-catalog.md). Answers 'what upgrades are available?' or looks up a feature. status ∈ available|planned|backlog|shipped (default available).",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["available", "planned", "backlog", "shipped"], description: "Which slice (default 'available')" },
        },
        required: [],
      },
    },
    {
      name: "biz_log_decision",
      description: "Log a business-development decision — a go/no-go call, decision to pursue or submit, QC verdict, or bid outcome.",
      inputSchema: {
        type: "object",
        properties: {
          decision: { type: "string", description: "The decision made" },
          context: { type: "string", description: "Why this decision was made (optional)" },
          category: { type: "string", description: "Category, e.g. 'go-no-go','pursue','submit','outcome','qc'" },
          rfp_id: { type: "string", description: "rfp_opportunities.notion_page_id this relates to (optional)" },
          logged_by: { type: "string", description: "Who made the decision (default: garrett)" },
        },
        required: ["decision"],
      },
    },
    {
      name: "biz_update_memory",
      description: "Update a key in Biz's working state memory.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'pipeline-note')" },
          value: { type: "string", description: "New value" },
          updated_by: { type: "string", description: "Who made the update (e.g. 'garrett')" },
        },
        required: ["key", "value", "updated_by"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    if (name === "biz_briefing") {
      const d = await apiFetch("/api/biz/briefing");
      const fmtUsd = (n) => `$${Math.round(n || 0).toLocaleString("en-US")}`;
      const lines = [];
      lines.push(`# Biz briefing`);
      const stages = Object.entries(d.by_status || {}).map(([s, n]) => `${s} ${n}`).join(" · ");
      lines.push(`## pipeline — ${d.pipeline_count} active · ${fmtUsd(d.pipeline_value)} raw value`);
      if (stages) lines.push(`_${stages}_`);
      lines.push(`\n## bid deadlines — next 30 days (${(d.upcoming_deadlines || []).length})`);
      if (!(d.upcoming_deadlines || []).length) lines.push("_nothing due_");
      for (const o of (d.upcoming_deadlines || []).slice(0, 10)) {
        lines.push(`- **${o.name}** — due ${o.due_date} · ${o.status} · ${o.fit}`);
      }
      lines.push(`\n## upgrades available — ${d.upgrades_available_count}`);
      if (!d.upgrades_available_count) lines.push("_all shipped_");
      else {
        for (const u of (d.upgrades_available || []).slice(0, 5)) {
          lines.push(`- **${u.feature_id}** ${u.title}${u.priority ? ` (${u.priority})` : ""}`);
        }
        if (d.upgrades_available_count > 5) lines.push(`_…and ${d.upgrades_available_count - 5} more — ask "what upgrades are available?"_`);
      }
      lines.push("\n## recent decisions");
      if (!(d.recent_decisions || []).length) lines.push("_none logged yet_");
      for (const dec of (d.recent_decisions || []).slice(0, 5)) {
        lines.push(`- ${dec.created_at.slice(0, 10)}: ${dec.decision}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "biz_roadmap") {
      const slice = args.status || "available";
      const path = slice === "available" ? "/api/biz/roadmap?available=1" : `/api/biz/roadmap?status=${encodeURIComponent(slice)}`;
      const items = await apiFetch(path);
      const lines = [`# Biz roadmap — ${slice} (${items.length})`];
      for (const i of items) {
        lines.push(`- **${i.feature_id}** ${i.title}${i.priority ? ` · ${i.priority}` : ""}${i.surface ? ` · ${i.surface}` : ""}${i.fixes && i.fixes !== "-" ? ` — fixes: ${i.fixes}` : ""}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "biz_log_decision") {
      const d = await apiFetch("/api/biz/decisions", {
        method: "POST",
        body: JSON.stringify({
          decision: args.decision, context: args.context || undefined,
          category: args.category || undefined, rfp_id: args.rfp_id || undefined,
          logged_by: args.logged_by || "garrett",
        }),
      });
      return { content: [{ type: "text", text: `decision logged (id: ${d.id})` }] };
    }

    if (name === "biz_update_memory") {
      const d = await apiFetch("/api/biz/memory", {
        method: "POST",
        body: JSON.stringify({ key: args.key, value: args.value, updated_by: args.updated_by }),
      });
      return { content: [{ type: "text", text: `memory updated: ${d.key}` }] };
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

main().catch(console.error);
