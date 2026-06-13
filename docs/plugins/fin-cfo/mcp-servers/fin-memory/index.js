const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} = require("@modelcontextprotocol/sdk/types.js");

const API_BASE = "https://port.windedvertigo.com";
const API_TOKEN = process.env.WV_AGENT_TOKEN;
if (!API_TOKEN) {
  process.stderr.write("fin-memory: WV_AGENT_TOKEN env var not set — add `export WV_AGENT_TOKEN=<token>` to ~/.zshrc\n");
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
  { name: "fin-memory", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "fin_briefing",
      description:
        "Load Fin's full financial state AND refresh live data. When called, perform these steps in order: (1) call QBO MCP tools — profit_loss_generator for current month + YTD, qbo_accounting_get_balance_sheet, qbo_accounting_get_ap_aging_summary, qbo_accounting_get_ar_aging_summary; (2) call Gusto MCP — list_payrolls for the most recent completed run; (3) search Gmail for financial emails in last 7 days (bills, invoices, tax notices, TaxDome messages, ADP alerts); (4) call fin_store_snapshot with all collected data; (5) fetch /api/fin/briefing to get open items + upcoming deadlines + recent decisions; (6) return a structured summary. If QBO or Gusto MCPs are unavailable, note which are missing and return cached snapshot data.",
      inputSchema: { type: "object", properties: {}, required: [] },
    },
    {
      name: "fin_store_snapshot",
      description: "Persist financial snapshots collected during fin_briefing. Keys: p_and_l, balance_sheet, ap_aging, ar_aging, payroll, period_label, fetched_at.",
      inputSchema: {
        type: "object",
        properties: {
          p_and_l: { type: "object", description: "QBO P&L data" },
          balance_sheet: { type: "object", description: "QBO balance sheet data" },
          ap_aging: { type: "object", description: "QBO AP aging summary" },
          ar_aging: { type: "object", description: "QBO AR aging summary" },
          payroll: { type: "object", description: "Gusto most recent payroll run" },
          period_label: { type: "string", description: "e.g. 'June 2026'" },
          fetched_at: { type: "string", description: "ISO timestamp when data was fetched" },
        },
        required: [],
      },
    },
    {
      name: "fin_log_item",
      description: "Log a financial action item — bill, invoice, tax notice, deadline, bank alert, TaxDome message, renewal, or other.",
      inputSchema: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["bill", "invoice", "tax_notice", "deadline", "bank_alert", "taxdome_message", "renewal", "other"] },
          title: { type: "string", description: "Clear description of the item" },
          source: { type: "string", description: "Where it came from (e.g. 'gmail', 'QBO', 'ADP')" },
          amount_cents: { type: "number", description: "Amount in cents (optional)" },
          due_date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
          notes: { type: "string", description: "Additional context (optional)" },
        },
        required: ["type", "title"],
      },
    },
    {
      name: "fin_log_decision",
      description: "Log a financial decision — a payment authorised, tax strategy confirmed, subscription cancelled, rollover decision made.",
      inputSchema: {
        type: "object",
        properties: {
          decision: { type: "string", description: "The decision made" },
          context: { type: "string", description: "Why this decision was made (optional)" },
          amount_cents: { type: "number", description: "Dollar amount in cents (optional)" },
          category: { type: "string", description: "Category (e.g. 'tax', 'payroll', 'subscription', 'retirement')" },
          logged_by: { type: "string", description: "Who made the decision (default: garrett)" },
        },
        required: ["decision"],
      },
    },
    {
      name: "fin_update_memory",
      description: "Update a key in Fin's working state memory.",
      inputSchema: {
        type: "object",
        properties: {
          key: { type: "string", description: "Memory key (e.g. 'open-items-note')" },
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
    if (name === "fin_briefing") {
      const d = await apiFetch("/api/fin/briefing");
      const lines = [];
      lines.push(`# Fin briefing (cached — last fetched: ${d.last_fetched_at?.slice(0, 16) ?? "never"} UTC)`);
      lines.push("_run fin_briefing with QBO + Gusto MCPs connected for live data_\n");
      lines.push(`## action required (${d.open_items_count} open)`);
      if (!d.open_items.length) lines.push("_none — all clear_");
      for (const i of (d.open_items || []).slice(0, 10)) {
        const due = i.due_date ? ` · due ${i.due_date}` : "";
        const amt = i.amount_cents ? ` · $${(i.amount_cents / 100).toFixed(2)}` : "";
        lines.push(`- **[${i.type}]** ${i.title}${due}${amt}`);
      }
      lines.push("\n## upcoming 30 days");
      if (!d.upcoming_deadlines.length) lines.push("_nothing scheduled_");
      for (const p of (d.upcoming_deadlines || []).slice(0, 8)) {
        lines.push(`- **${p.vendor}** — ${p.description}${p.next_expected ? ` (${p.next_expected})` : ""}`);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "fin_store_snapshot") {
      const payload = {};
      for (const k of ["p_and_l", "balance_sheet", "ap_aging", "ar_aging", "payroll", "period_label", "fetched_at"]) {
        if (args[k] !== undefined) payload[k] = args[k];
      }
      const d = await apiFetch("/api/fin/briefing", { method: "POST", body: JSON.stringify(payload) });
      return { content: [{ type: "text", text: `snapshots stored: ${(d.upserted || []).join(", ")} (${d.count} total)` }] };
    }

    if (name === "fin_log_item") {
      const d = await apiFetch("/api/fin/items", {
        method: "POST",
        body: JSON.stringify({
          type: args.type, title: args.title,
          source: args.source || undefined,
          amount_cents: args.amount_cents || undefined,
          due_date: args.due_date || undefined,
          notes: args.notes || undefined,
        }),
      });
      return { content: [{ type: "text", text: `item logged (id: ${d.id}) — [${d.type}] ${d.title}` }] };
    }

    if (name === "fin_log_decision") {
      const d = await apiFetch("/api/fin/decisions", {
        method: "POST",
        body: JSON.stringify({
          decision: args.decision, context: args.context || undefined,
          amount_cents: args.amount_cents || undefined,
          category: args.category || undefined,
          logged_by: args.logged_by || "garrett",
        }),
      });
      return { content: [{ type: "text", text: `decision logged (id: ${d.id})` }] };
    }

    if (name === "fin_update_memory") {
      const d = await apiFetch("/api/fin/memory", {
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
