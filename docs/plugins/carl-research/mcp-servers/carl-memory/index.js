const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const API_BASE = "https://port.windedvertigo.com";
const API_TOKEN = process.env.WV_AGENT_TOKEN;
if (!API_TOKEN) {
  process.stderr.write("carl-memory: WV_AGENT_TOKEN env var not set — add `export WV_AGENT_TOKEN=<token>` to ~/.zshrc\n");
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
  { name: "carl-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "carl_briefing",
      description: "Load cARL's full working state — active research domains, recent library findings, working state, and 14 days of conversation history. Call silently at session start.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "carl_log_decision",
      description: "Log a research decision or direction to cARL's persistent memory — when a framework is adopted, a domain is prioritised, or a key insight is confirmed.",
      inputSchema: {
        type: "object",
        properties: {
          who: { type: "string", description: "Name of the person in the conversation" },
          summary: { type: "string", description: "Summary of what was discussed" },
          decisions: {
            type: "array",
            items: { type: "string" },
            description: "Specific research decisions or directions adopted",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Research domain tags e.g. ['threshold-concepts', 'harbour', 'UDL']",
          },
          session_type: { type: "string", description: "Session type, default 'cowork'" },
        },
        required: ["who", "summary"],
      },
    },
    {
      name: "carl_update_memory",
      description: "Update a key in cARL's working state memory. Use when research priorities shift, a new domain becomes active, or a framework is adopted.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'active-research-domains')" },
          value: { type: "string", description: "New value" },
          updated_by: { type: "string", description: "Who made the update" },
        },
        required: ["key", "value", "updated_by"],
      },
    },
    {
      name: "carl_add_finding",
      description: "Add a synthesised finding to cARL's living research library. Call when a relevant study, framework, or insight is surfaced that connects to the team's work.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Research domain (e.g. 'threshold concepts', 'play-based learning', 'UDL')" },
          title: { type: "string", description: "Clear descriptive title of the finding" },
          summary: { type: "string", description: "1-3 sentence distilled insight (not raw notes)" },
          source: { type: "string", description: "Author(s) and title of the source" },
          citation: { type: "string", description: "Enough detail to find the source (author, year, journal/book)" },
          relevance: { type: "string", description: "How this connects to what the team is currently building" },
          tags: { type: "array", items: { type: "string" }, description: "Searchable tags" },
          connected_to: {
            type: "array",
            items: { type: "string" },
            description: "Related concepts or other finding titles",
          },
        },
        required: ["domain", "title", "summary"],
      },
    },
    {
      name: "carl_search_findings",
      description: "Search cARL's living research library by domain, tags, or keyword. Call before starting a research response to check what's already known.",
      inputSchema: {
        type: "object",
        properties: {
          domain: { type: "string", description: "Filter by research domain" },
          tags: { type: "string", description: "Filter by tag (single tag)" },
          search: { type: "string", description: "Keyword search across title and summary" },
        },
        required: [],
      },
    },
    {
      name: "carl_curriculum",
      description: "Read cARL's target curriculum — the marketing + lifelong-learning syllabus cARL is working toward, with each topic's coverage status (planned / in-progress / covered). Use it to see what's covered, what the blind spots are (planned-but-uncovered topics), and what to research next when a teammate asks for a deep session.",
      inputSchema: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: planned | in-progress | covered (optional)" },
          domain: { type: "string", description: "Filter by domain (optional)" },
        },
        required: [],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "carl_briefing") {
      const data = await apiFetch("/api/carl/briefing");
      return { content: [{ type: "text", text: data.briefing }] };
    }

    if (name === "carl_log_decision") {
      const data = await apiFetch("/api/carl/decisions", {
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

    if (name === "carl_update_memory") {
      const data = await apiFetch("/api/carl/memory", {
        method: "POST",
        body: JSON.stringify({
          key: args.key,
          value: args.value,
          updated_by: args.updated_by,
        }),
      });
      return { content: [{ type: "text", text: `memory updated: ${data.key}` }] };
    }

    if (name === "carl_add_finding") {
      const data = await apiFetch("/api/carl/findings", {
        method: "POST",
        body: JSON.stringify({
          domain: args.domain,
          title: args.title,
          summary: args.summary,
          source: args.source || undefined,
          citation: args.citation || undefined,
          relevance: args.relevance || undefined,
          tags: args.tags || [],
          connected_to: args.connected_to || undefined,
        }),
      });
      return { content: [{ type: "text", text: `finding added to library (id: ${data.id}) — ${args.domain}: ${args.title}` }] };
    }

    if (name === "carl_search_findings") {
      const params = new URLSearchParams();
      if (args.domain) params.set("domain", args.domain);
      if (args.tags) params.set("tags", args.tags);
      if (args.search) params.set("search", args.search);

      const findings = await apiFetch(`/api/carl/findings?${params.toString()}`);
      if (!findings.length) {
        return { content: [{ type: "text", text: "no findings match that query" }] };
      }
      const summary = findings.map((f) =>
        `**${f.domain} — ${f.title}**\n${f.summary}${f.relevance ? `\n_relevance: ${f.relevance}_` : ""}`
      ).join("\n\n");
      return { content: [{ type: "text", text: summary }] };
    }

    if (name === "carl_curriculum") {
      const params = new URLSearchParams();
      if (args.status) params.set("status", args.status);
      if (args.domain) params.set("domain", args.domain);
      const qs = params.toString();
      const topics = await apiFetch(`/api/carl/curriculum${qs ? `?${qs}` : ""}`);
      if (!topics.length) {
        return { content: [{ type: "text", text: "no curriculum topics match that query" }] };
      }
      // group by domain with coverage marks
      const byDomain = {};
      for (const t of topics) (byDomain[t.domain] ??= []).push(t);
      const mark = { covered: "✓", "in-progress": "◐", planned: "○" };
      const lines = Object.entries(byDomain).map(([domain, ts]) => {
        const rows = ts.map((t) => `  ${mark[t.status] || "○"} ${t.topic}${t.key_works?.length ? ` — ${t.key_works.join("; ")}` : ""}`).join("\n");
        const covered = ts.filter((t) => t.status === "covered").length;
        return `**${domain}** (${covered}/${ts.length})\n${rows}`;
      });
      return { content: [{ type: "text", text: lines.join("\n\n") }] };
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
  process.stderr.write(`carl-memory MCP server error: ${err.message}\n`);
  process.exit(1);
});
