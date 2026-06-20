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
    {
      name: "biz_qc_review",
      description:
        "Run a QC review on a drafted bid (a 'version two' second look). Returns the materials checklist, requirements, CV roster + currency, and submission logistics for the opportunity, plus a gate-by-gate recipe. Pass rfp_id. After running the gates, log the verdict (biz_log_decision) and call biz_request_review when review-ready.",
      inputSchema: {
        type: "object",
        properties: { rfp_id: { type: "string", description: "rfp_opportunities.notion_page_id of the bid to QC" } },
        required: ["rfp_id"],
      },
    },
    {
      name: "biz_request_review",
      description: "DM Garrett + Maria that a bid is review-ready. Translate the deadline into Pacific time in due_local so the cutoff is obvious.",
      inputSchema: {
        type: "object",
        properties: {
          rfp_id: { type: "string", description: "rfp_opportunities.notion_page_id (optional)" },
          name: { type: "string", description: "Opportunity name" },
          summary: { type: "string", description: "1–3 line summary: fit, what's ready, open flags" },
          due_date: { type: "string", description: "Due date YYYY-MM-DD (optional)" },
          due_local: { type: "string", description: "Deadline across timezones, e.g. '28 Jun 17:00 EAT = 07:00 PT' (optional)" },
          review_url: { type: "string", description: "Link to the bundle (optional)" },
          reviewers: { type: "array", items: { type: "string" }, description: "Override reviewer emails (optional)" },
        },
        required: ["name", "summary"],
      },
    },
    {
      name: "biz_go_no_go",
      description: "Assess whether to pursue an opportunity. Returns scoring inputs (facts, eligibility, fit, value, days-to-deadline, formula win-probability, existing decision) + the scorecard recipe. Pass rfp_id; record with biz_set_bid_decision.",
      inputSchema: { type: "object", properties: { rfp_id: { type: "string", description: "rfp_opportunities.notion_page_id" } }, required: ["rfp_id"] },
    },
    {
      name: "biz_set_bid_decision",
      description: "Record a go/no-go verdict — writes bid_decision + score + reason AND moves the card off radar by default (bid→pursuing, no-bid→no-go; deferred stays). Pass advance_status:false to record only.",
      inputSchema: {
        type: "object",
        properties: {
          rfp_id: { type: "string", description: "rfp_opportunities.notion_page_id" },
          decision: { type: "string", enum: ["bid", "no-bid", "deferred"], description: "The verdict" },
          score: { type: "number", description: "Weighted total 0–100 (optional)" },
          reason: { type: "string", description: "One- or two-line rationale" },
          advance_status: { type: "boolean", description: "Default true: move the card. false to record only." },
        },
        required: ["rfp_id", "decision"],
      },
    },
    {
      name: "biz_list",
      description: "List opportunities (with rfp_ids) to iterate a kanban column. status: a stage (radar|reviewing|pursuing|interviewing|submitted|won|lost|no-go), 'active', or 'all'. e.g. biz_list('radar') then biz_go_no_go on each.",
      inputSchema: { type: "object", properties: { status: { type: "string", description: "Stage, 'active', or 'all' (default 'active')" } }, required: [] },
    },
    {
      name: "biz_log_outcome",
      description: "Close a bid (won/lost/no-go) with a structured debrief — sets status + what-worked/what-fell-flat/client-feedback/lessons, and logs it. Feeds rfp-postmortem-to-library.",
      inputSchema: {
        type: "object",
        properties: {
          rfp_id: { type: "string", description: "rfp_opportunities.notion_page_id" },
          outcome: { type: "string", enum: ["won", "lost", "no-go"], description: "Final outcome" },
          what_worked: { type: "string", description: "What worked (optional)" },
          what_fell_flat: { type: "string", description: "What fell flat (optional)" },
          client_feedback: { type: "string", description: "Client/funder feedback (optional)" },
          lessons: { type: "string", description: "Lessons for next time (optional)" },
        },
        required: ["rfp_id", "outcome"],
      },
    },
  ],
}));

const GONOGO_RECIPE = [
  "", "---", "## score the go/no-go",
  "1. **eligibility (pass/fail)** — eligible at all? if a mandatory requirement fails → no-bid, stop.",
  "2. **weighted scorecard (0–100)** — fit (win-probability is a start, not the answer), capacity (team + bandwidth vs days-to-deadline + load), strategic value, win-likelihood (competition / differentiation), economics (value vs effort + margin; pull rates via fin_briefing if close).",
  "3. **verdict bands** — <40 no-bid · 40–70 defer (name the gap) · >70 bid.",
  "", "then: give a clear bid · no-bid · defer + one-line rationale, record with biz_set_bid_decision. on a bid: hand the deadline + tasks to PaM (pam_create_commitment) and queue biz_qc_review once a draft exists.",
].join("\n");

const QC_RECIPE = [
  "", "---", "## run the QC gates (your second look → version two)",
  "1. **materials completeness** — every baseline doc present? every submission-requirement confirmed? flag missing/unconfirmed.",
  "2. **CV quality** — named team (Garrett, Lamis, Maria always; Payton substantive; James if curriculum) in the bundle's CVs; check the roster for stale; flag copy-pasted/identical entries across members.",
  "3. **consistency / conflict** — pull the bundle locally, run `align-narrative-across-deliverables`; cross-check deal-page facts vs bundle vs TOR; flag contradictions.",
  "4. **submission logistics** — confirm due date + funder timezone (translate to Pacific), submission channel (portal vs email), and that the materials checklist is complete.",
  "5. **quality** — sections vs w.v minimums; use `inject-evidence-from-port` on thin sections.",
  "6. **go/no-go** — verdict (go · fix-then-go · no-go) + rationale; log with `biz_log_decision`.",
  "", "then: produce a concise QC report, regenerate a **v2 bundle locally** if needed (`rfp-proposal-from-tor`; do NOT write to Notion), and call `biz_request_review` when review-ready.",
].join("\n");

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
        lines.push(`- **${o.name}** — due ${o.due_date} · ${o.status} · ${o.fit} · \`${o.id}\``);
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

    if (name === "biz_qc_review") {
      if (!args.rfp_id) return { content: [{ type: "text", text: "rfp_id is required" }], isError: true };
      const q = await apiFetch(`/api/biz/qc/${encodeURIComponent(String(args.rfp_id))}`);
      const o = q.opportunity;
      const lines = [];
      lines.push(`# QC review — ${o.name}`);
      lines.push(`${o.type} · ${o.status} · fit: ${o.fit}${o.estimated_value ? ` · $${Math.round(o.estimated_value).toLocaleString("en-US")}` : ""}`);
      lines.push(`due: ${o.due_date ?? "—"}${o.deadline_timezone ? ` (${o.deadline_timezone})` : " (timezone not set — confirm)"}`);
      if (o.rfp_document_url) lines.push(`TOR: ${o.rfp_document_url}`);
      lines.push("\n## materials checklist");
      for (const m of q.materials_checklist) {
        const mark = m.present === true ? "✅" : m.present === false ? "❌ missing" : "❓ confirm manually";
        lines.push(`- ${mark} — ${m.label}${m.basis === "submission-requirement" ? " _(funder requirement)_" : ""}`);
      }
      lines.push(`\n## requirements — ${q.requirements.total} extracted`);
      lines.push(Object.entries(q.requirements.by_kind).map(([k, n]) => `${k}: ${n}`).join(" · ") || "_none extracted_");
      if (q.requirements.unapproved_required_deliverables > 0) lines.push(`⚠️ ${q.requirements.unapproved_required_deliverables} required deliverable(s) not yet approved`);
      lines.push("\n## CVs (canonical roster)");
      if (!q.cvs.length) lines.push("_no CVs in collective_cv_");
      for (const c of q.cvs) lines.push(`- ${c.current ? "🟢 current" : "🔴 stale"} — ${c.name}${c.last_verified_at ? ` (verified ${c.last_verified_at.slice(0, 10)})` : " (never verified)"}`);
      lines.push(`\n## readiness: ${q.readiness.ready ? "✅ ready" : `⚠️ ${q.readiness.reason}`}`);
      lines.push(QC_RECIPE);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "biz_request_review") {
      const d = await apiFetch("/api/biz/notify-review", {
        method: "POST",
        body: JSON.stringify({
          rfp_id: args.rfp_id || undefined, name: args.name, summary: args.summary,
          due_date: args.due_date || undefined, due_local: args.due_local || undefined,
          review_url: args.review_url || undefined, reviewers: args.reviewers || undefined,
        }),
      });
      const failed = (d.failed || []).length ? ` · failed: ${d.failed.join(", ")}` : "";
      return { content: [{ type: "text", text: `review request DM'd to ${(d.sent || []).join(", ") || "no one"}${failed}` }] };
    }

    if (name === "biz_go_no_go") {
      if (!args.rfp_id) return { content: [{ type: "text", text: "rfp_id is required" }], isError: true };
      const g = await apiFetch(`/api/biz/go-no-go/${encodeURIComponent(String(args.rfp_id))}`);
      const lines = [];
      lines.push(`# go/no-go — ${g.name}`);
      lines.push(`${g.type} · ${g.status} · fit: ${g.fit}${g.estimated_value ? ` · $${Math.round(g.estimated_value).toLocaleString("en-US")}` : ""}`);
      lines.push(`deadline: ${g.due_date ?? "—"}${g.days_to_deadline != null ? ` (${g.days_to_deadline}d out)` : ""} · formula win-probability: **${g.win_probability}%**`);
      lines.push("\n## eligibility requirements");
      if (!g.eligibility.length) lines.push("_none extracted — confirm from the TOR_");
      for (const e of g.eligibility) lines.push(`- ${e.required ? "**(mandatory)** " : ""}${e.label}`);
      if (g.current_decision && g.current_decision.decision) lines.push(`\n_current decision on file: **${g.current_decision.decision}**_`);
      lines.push(GONOGO_RECIPE);
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "biz_set_bid_decision") {
      const d = await apiFetch("/api/biz/bid-decision", {
        method: "POST",
        body: JSON.stringify({ rfp_id: args.rfp_id, decision: args.decision, score: args.score, reason: args.reason || undefined, advance_status: args.advance_status }),
      });
      return { content: [{ type: "text", text: `recorded: ${d.decision}${d.score != null ? ` (${d.score}/100)` : ""}${d.moved_to ? ` → moved to ${d.moved_to}` : ""}` }] };
    }

    if (name === "biz_list") {
      const status = args.status || "active";
      const d = await apiFetch(`/api/biz/opportunities?status=${encodeURIComponent(status)}`);
      const lines = [`# opportunities — ${status} (${d.count})`];
      for (const o of d.items) {
        lines.push(`- **${o.name}** — ${o.status} · ${o.fit}${o.value ? ` · $${Math.round(o.value).toLocaleString("en-US")}` : ""}${o.due_date ? ` · due ${o.due_date}` : ""}\n  \`rfp_id: ${o.id}\``);
      }
      return { content: [{ type: "text", text: lines.join("\n") }] };
    }

    if (name === "biz_log_outcome") {
      const d = await apiFetch("/api/biz/outcome", {
        method: "POST",
        body: JSON.stringify({ rfp_id: args.rfp_id, outcome: args.outcome, what_worked: args.what_worked, what_fell_flat: args.what_fell_flat, client_feedback: args.client_feedback, lessons: args.lessons }),
      });
      return { content: [{ type: "text", text: `outcome recorded: ${d.outcome} — debrief saved. consider the rfp-postmortem-to-library skill to bank the lessons.` }] };
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
