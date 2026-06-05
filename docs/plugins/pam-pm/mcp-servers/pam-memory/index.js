const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const API_BASE = "https://port.windedvertigo.com";
const API_TOKEN = process.env.WV_AGENT_TOKEN;
if (!API_TOKEN) {
  process.stderr.write("pam-memory: WV_AGENT_TOKEN env var not set — add `export WV_AGENT_TOKEN=<token>` to ~/.zshrc\n");
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
  { name: "pam-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "pam_briefing",
      description: "Load PaM's full working state — active commitments, overdue items, blocked dependencies, working state, and 14 days of conversation history. Call silently at session start.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "pam_log_decision",
      description: "Log a project-level decision or context shift to PaM's persistent memory. Call when commitments are made, status changes, or blockers surface.",
      inputSchema: {
        type: "object",
        properties: {
          who: { type: "string", description: "Name of the person in the conversation" },
          summary: { type: "string", description: "Summary of what was discussed" },
          decisions: {
            type: "array",
            items: { type: "string" },
            description: "List of specific decisions or action items",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Relevant tags e.g. ['commitments', 'blockers', 'whirlpool']",
          },
          session_type: { type: "string", description: "Session type, default 'cowork'" },
        },
        required: ["who", "summary"],
      },
    },
    {
      name: "pam_update_memory",
      description: "Update a key in PaM's working state memory. Use when team state changes — someone's focus shifts, overdue items resolve, next whirlpool is scheduled.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'garrett-commitments')" },
          value: { type: "string", description: "New value" },
          updated_by: { type: "string", description: "Who made the update" },
        },
        required: ["key", "value", "updated_by"],
      },
    },
    {
      name: "pam_create_commitment",
      description: "Create a new commitment in PaM's tracker. Use when a team member commits to doing something in a conversation.",
      inputSchema: {
        type: "object",
        properties: {
          who: { type: "string", description: "Person making the commitment (e.g. 'garrett')" },
          what: { type: "string", description: "What they committed to" },
          due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
          source: { type: "string", description: "Where it was committed (e.g. 'whirlpool', 'cowork', 'slack')" },
          depends_on: {
            type: "array",
            items: { type: "string" },
            description: "IDs of commitments this depends on (optional)",
          },
        },
        required: ["who", "what"],
      },
    },
    {
      name: "pam_update_commitment",
      description: "Update the status of an existing commitment. Use when something is done, blocked, or changes.",
      inputSchema: {
        type: "object",
        properties: {
          id: { type: "string", description: "UUID of the commitment to update" },
          status: {
            type: "string",
            enum: ["not-started", "in-progress", "blocked", "done", "parked"],
            description: "New status",
          },
          blocker: { type: "string", description: "Description of what's blocking it (if status is 'blocked')" },
          completed_at: { type: "string", description: "Completion timestamp in ISO format (if marking done)" },
        },
        required: ["id"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    if (name === "pam_briefing") {
      const data = await apiFetch("/api/pam/briefing");
      return { content: [{ type: "text", text: data.briefing }] };
    }

    if (name === "pam_log_decision") {
      const data = await apiFetch("/api/pam/decisions", {
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

    if (name === "pam_update_memory") {
      const data = await apiFetch("/api/pam/memory", {
        method: "POST",
        body: JSON.stringify({
          key: args.key,
          value: args.value,
          updated_by: args.updated_by,
        }),
      });
      return { content: [{ type: "text", text: `memory updated: ${data.key}` }] };
    }

    if (name === "pam_create_commitment") {
      const data = await apiFetch("/api/pam/commitments", {
        method: "POST",
        body: JSON.stringify({
          who: args.who,
          what: args.what,
          due_date: args.due_date || undefined,
          source: args.source || undefined,
          depends_on: args.depends_on || undefined,
        }),
      });
      return { content: [{ type: "text", text: `commitment created (id: ${data.id}) — ${args.who}: ${args.what}` }] };
    }

    if (name === "pam_update_commitment") {
      if (!args.id) throw new Error("id is required");
      const update = {};
      if (args.status) update.status = args.status;
      if (args.blocker) update.blocker = args.blocker;
      if (args.completed_at) update.completed_at = args.completed_at;

      const data = await apiFetch(`/api/pam/commitments?id=${encodeURIComponent(args.id)}`, {
        method: "PATCH",
        body: JSON.stringify(update),
      });
      return { content: [{ type: "text", text: `commitment updated — ${data.who}: ${data.what} [${data.status}]` }] };
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
  process.stderr.write(`pam-memory MCP server error: ${err.message}\n`);
  process.exit(1);
});
