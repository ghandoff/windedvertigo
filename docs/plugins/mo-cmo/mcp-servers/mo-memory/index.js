const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const API_BASE = "https://port.windedvertigo.com";
const API_TOKEN = process.env.WV_AGENT_TOKEN;
if (!API_TOKEN) {
  process.stderr.write("mo-memory: WV_AGENT_TOKEN env var not set — add `export WV_AGENT_TOKEN=<token>` to ~/.zshrc\n");
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
  { name: "mo-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "cmo_briefing",
      description: "Load Mo's full working state — current strategy, pipeline, recent decisions, and 14 days of conversation history. Call silently at session start.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "cmo_log_decision",
      description: "Log a decision or insight from the current conversation to Mo's persistent memory. Call during conversation when a strategic decision is made, not at the end.",
      inputSchema: {
        type: "object",
        properties: {
          who: { type: "string", description: "Name of the person in the conversation (e.g. 'garrett')" },
          summary: { type: "string", description: "Summary of what was discussed" },
          decisions: {
            type: "array",
            items: { type: "string" },
            description: "List of specific decisions made",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Relevant tags e.g. ['pipeline', 'harbour', 'brand']",
          },
          session_type: { type: "string", description: "Session type, default 'cowork'" },
        },
        required: ["who", "summary"],
      },
    },
    {
      name: "cmo_update_memory",
      description: "Update a key in Mo's working state memory. Use when strategic state changes — pipeline numbers, priorities, statuses.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'pipeline-total')" },
          value: { type: "string", description: "New value" },
          updated_by: { type: "string", description: "Who made the update (e.g. 'garrett')" },
        },
        required: ["key", "value", "updated_by"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "cmo_briefing") {
      const data = await apiFetch("/api/cmo/briefing");
      return { content: [{ type: "text", text: data.briefing }] };
    }

    if (name === "cmo_log_decision") {
      const data = await apiFetch("/api/cmo/decisions", {
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

    if (name === "cmo_update_memory") {
      const data = await apiFetch("/api/cmo/memory", {
        method: "POST",
        body: JSON.stringify({
          key: args.key,
          value: args.value,
          updated_by: args.updated_by,
        }),
      });
      return { content: [{ type: "text", text: `memory updated: ${data.key}` }] };
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
  process.stderr.write(`mo-memory MCP server error: ${err.message}\n`);
  process.exit(1);
});
