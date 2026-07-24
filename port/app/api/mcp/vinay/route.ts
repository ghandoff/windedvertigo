/**
 * POST /api/mcp/vinay — remote MCP server for vinay, garrett's personal
 * assistant. Same JSON-RPC 2.0 protocol shim as /api/mcp/agents/[agent], but a
 * SEPARATE connector with its own garrett-only gate — deliberately NOT part of
 * the shared /api/mcp/agents/all bundle (which admits any @windedvertigo.com
 * account). The DB project split (wv-vinay) protects personal data at rest;
 * this route protects the query door.
 *
 * Auth (authorizeVinay): EITHER a dedicated Bearer VINAY_API_TOKEN (Claude
 * Code — never the shared CMO_API_TOKEN) OR an OAuth access token whose subject
 * is garrett (the sub check is the real boundary; the domain-wide isAllowedEmail
 * is intentionally NOT used here). Path is exempt from session auth in
 * middleware (/api/mcp/*).
 *
 * Tools call the lib/vinay/* data layer directly — vinay has no legacy stdio
 * server to mirror, so the extra /api/{agent}/* REST hop the exec agents use is
 * collapsed away.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ISSUER,
  RESOURCE,
  PROTECTED_RESOURCE_METADATA_URL,
  oauthSecret,
  isVinayOwner,
  VINAY_OWNER_EMAIL,
} from "@/lib/oauth/config";
import { verifyJwt } from "@/lib/oauth/jwt";
import { getVinayMemory, upsertVinayMemory } from "@/lib/vinay/memory";
import {
  createVinayCommitment,
  listVinayCommitments,
  updateVinayCommitment,
  type VinayCommitmentStatus,
} from "@/lib/vinay/commitments";
import { logVinayJournal, listVinayJournal } from "@/lib/vinay/journal";
import { logVinayDecision, listVinayDecisions } from "@/lib/vinay/decisions";
import { getLatestVinayBrief } from "@/lib/vinay/briefs";
import { getLatestVinayRun } from "@/lib/vinay/runs";
import { gradeVinayBrief, type VinayGrade } from "@/lib/vinay/grades";

export const maxDuration = 60;

/** vinay's own resource identifier (a garrett token minted for the shared
 * agents resource is also accepted — see authorizeVinay). */
const VINAY_RESOURCE = `${ISSUER}/api/mcp/vinay`;

// ── tool catalog ─────────────────────────────────────────────────────────────

interface ToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}
interface ToolResult {
  text: string;
  isError?: boolean;
}

const STR = { type: "string" } as const;

const VINAY_TOOLS: ToolDef[] = [
  {
    name: "vinay_context",
    description:
      "Load vinay's current state — working memory, open commitments, recent session journal, and recent decisions. Call silently at the start of a session.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vinay_set_memory",
    description:
      "Upsert a key in vinay's working memory — durable facts about garrett's world (e.g. 'current-focus', 'learning-queue'). Use when a lasting fact changes.",
    inputSchema: {
      type: "object",
      properties: {
        key: { ...STR, description: "Memory key (e.g. 'current-focus')" },
        value: { ...STR, description: "New value" },
      },
      required: ["key", "value"],
    },
  },
  {
    name: "vinay_add_commitment",
    description:
      "Log something garrett said he'd do (work or personal), so it isn't dropped. Use when a promise is made in passing.",
    inputSchema: {
      type: "object",
      properties: {
        what: { ...STR, description: "What was committed to" },
        due_date: { ...STR, description: "Due date YYYY-MM-DD (optional)" },
        source: { ...STR, description: "Where it was committed (e.g. 'cowork', 'slack', 'email')" },
      },
      required: ["what"],
    },
  },
  {
    name: "vinay_update_commitment",
    description: "Update a commitment's status. Use when something is done, blocked, or parked.",
    inputSchema: {
      type: "object",
      properties: {
        id: { ...STR, description: "UUID of the commitment" },
        status: {
          type: "string",
          enum: ["not-started", "in-progress", "blocked", "done", "parked"],
          description: "New status",
        },
        completed_at: { ...STR, description: "Completion timestamp ISO (optional; auto-set when marking done)" },
      },
      required: ["id", "status"],
    },
  },
  {
    name: "vinay_log_journal",
    description:
      "Append the 3-line session end-cap: what you did, what's open, what's next. Called by the /end-of-day-sync hook, or any time a session wraps.",
    inputSchema: {
      type: "object",
      properties: {
        did: { ...STR, description: "What got done this session" },
        open: { ...STR, description: "What's still open / unfinished" },
        next: { ...STR, description: "What's next / the natural next step" },
      },
      required: [],
    },
  },
  {
    name: "vinay_log_decision",
    description:
      "Append an immutable decision or insight from the session. Feeds the future reflection loop; distinct from mutable memory.",
    inputSchema: {
      type: "object",
      properties: {
        decision: { ...STR, description: "The decision or insight" },
        context: { ...STR, description: "Why / surrounding context (optional)" },
        category: { ...STR, description: "Tag e.g. 'preference', 'workflow', 'personal' (optional)" },
      },
      required: ["decision"],
    },
  },
  {
    name: "vinay_brief",
    description:
      "Read vinay's latest daily anticipation brief — what's coming, what might slip, what to do first — plus when the sweep last ran. Read this in the morning.",
    inputSchema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "vinay_grade_brief",
    description:
      "Grade vinay's latest brief (or one item in it) so it learns what's useful. Use right after reading the brief.",
    inputSchema: {
      type: "object",
      properties: {
        grade: { type: "string", enum: ["useful", "not-useful", "wrong"], description: "Your verdict" },
        item_key: { ...STR, description: "Which item (e.g. 'item-2'); omit to grade the whole brief" },
        note: { ...STR, description: "Optional note on why" },
      },
      required: ["grade"],
    },
  },
];

// ── tool dispatch (calls lib/vinay/* directly) ───────────────────────────────

async function callVinay(
  name: string,
  a: Record<string, unknown>,
  actor: string,
): Promise<ToolResult> {
  if (name === "vinay_context") {
    const [memory, commitments, journal, decisions] = await Promise.all([
      getVinayMemory(),
      listVinayCommitments({ openOnly: true, limit: 50 }),
      listVinayJournal({ limit: 5 }),
      listVinayDecisions({ limit: 5 }),
    ]);
    const lines: string[] = ["# vinay — current state"];
    lines.push(`\n## working memory (${memory.length})`);
    if (!memory.length) lines.push("_empty_");
    for (const m of memory) lines.push(`- **${m.key}**: ${m.value}`);
    lines.push(`\n## open commitments (${commitments.length})`);
    if (!commitments.length) lines.push("_none_");
    for (const c of commitments)
      lines.push(`- ${c.what}${c.due_date ? ` · due ${c.due_date}` : ""} [${c.status}] \`${c.id}\``);
    lines.push(`\n## recent journal`);
    if (!journal.length) lines.push("_none_");
    for (const j of journal)
      lines.push(
        `- ${j.created_at.slice(0, 10)} — did: ${j.did ?? "—"} · open: ${j.open ?? "—"} · next: ${j.next ?? "—"}`,
      );
    lines.push(`\n## recent decisions`);
    if (!decisions.length) lines.push("_none_");
    for (const d of decisions)
      lines.push(`- ${d.created_at.slice(0, 10)} — ${d.decision}${d.category ? ` (${d.category})` : ""}`);
    return { text: lines.join("\n") };
  }
  if (name === "vinay_set_memory") {
    if (!a.key || !a.value) return { text: "key and value are required", isError: true };
    const d = await upsertVinayMemory(String(a.key), String(a.value), actor);
    return { text: `memory updated: ${d.key}` };
  }
  if (name === "vinay_add_commitment") {
    if (!a.what) return { text: "what is required", isError: true };
    const d = await createVinayCommitment({
      what: String(a.what),
      due_date: (a.due_date as string) || null,
      source: (a.source as string) || null,
    });
    return {
      text: `commitment logged (id: ${d.id}) — ${a.what}${a.due_date ? ` · due ${a.due_date}` : ""}`,
    };
  }
  if (name === "vinay_update_commitment") {
    if (!a.id || !a.status) return { text: "id and status are required", isError: true };
    const d = await updateVinayCommitment(String(a.id), {
      status: a.status as VinayCommitmentStatus,
      completed_at: (a.completed_at as string) ?? undefined,
    });
    return { text: `commitment updated — ${d.what} [${d.status}]` };
  }
  if (name === "vinay_log_journal") {
    const d = await logVinayJournal({
      did: (a.did as string) || null,
      open: (a.open as string) || null,
      next: (a.next as string) || null,
      source: (a.source as string) || "end-of-day-sync",
    });
    return { text: `journal entry logged (id: ${d.id})` };
  }
  if (name === "vinay_log_decision") {
    if (!a.decision) return { text: "decision is required", isError: true };
    const d = await logVinayDecision({
      decision: String(a.decision),
      context: (a.context as string) || null,
      category: (a.category as string) || null,
      logged_by: actor,
    });
    return { text: `decision logged (id: ${d.id})` };
  }
  if (name === "vinay_brief") {
    const [brief, run] = await Promise.all([getLatestVinayBrief(), getLatestVinayRun("anticipation")]);
    const runNote = run ? `last sweep: ${run.status} at ${run.ran_at}${run.detail ? ` — ${run.detail}` : ""}` : "the daily sweep hasn't run yet";
    if (!brief) return { text: `no brief yet. ${runNote}` };
    const lines: string[] = [`# vinay brief — ${brief.brief_date}`, "", brief.body ?? ""];
    if (brief.items?.length) {
      lines.push("", "## items");
      for (const it of brief.items) lines.push(`- \`${it.key}\` ${it.title}${it.detail ? ` — ${it.detail}` : ""}`);
    }
    lines.push("", `_${runNote}_`);
    return { text: lines.join("\n") };
  }
  if (name === "vinay_grade_brief") {
    if (!a.grade) return { text: "grade is required", isError: true };
    const brief = await getLatestVinayBrief();
    if (!brief) return { text: "no brief to grade yet", isError: true };
    await gradeVinayBrief({
      brief_id: brief.id,
      grade: a.grade as VinayGrade,
      item_key: (a.item_key as string) || null,
      note: (a.note as string) || null,
    });
    return { text: `graded ${a.item_key ? `item ${a.item_key}` : "the brief"} as ${a.grade}` };
  }
  return { text: `unknown tool: ${name}`, isError: true };
}

// ── garrett-only auth gate ───────────────────────────────────────────────────

/**
 * Accept EITHER the dedicated VINAY_API_TOKEN (never the shared CMO_API_TOKEN)
 * OR an OAuth access token whose subject is garrett. The sub check is the real
 * boundary; a garrett token minted for the shared agents resource OR a vinay-
 * specific one is accepted (aud is defence-in-depth, not the gate). Returns the
 * authenticated owner email, or null.
 */
async function authorizeVinay(req: NextRequest): Promise<string | null> {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const provided = header.slice(7);
  if (!provided) return null;

  // dedicated static token — constant-time compare (NOT CMO_API_TOKEN)
  const staticTok = process.env.VINAY_API_TOKEN;
  if (staticTok && provided.length === staticTok.length) {
    let mismatch = 0;
    for (let i = 0; i < provided.length; i++) mismatch |= provided.charCodeAt(i) ^ staticTok.charCodeAt(i);
    if (mismatch === 0) return VINAY_OWNER_EMAIL;
  }
  // OAuth access token — garrett only
  try {
    const claims = await verifyJwt(provided, oauthSecret());
    if (
      claims &&
      claims.type === "access" &&
      isVinayOwner(claims.sub) &&
      (claims.aud === RESOURCE || claims.aud === VINAY_RESOURCE)
    ) {
      return claims.sub.toLowerCase();
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

// ── JSON-RPC plumbing (mirrors /api/mcp/agents/[agent]) ──────────────────────

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

const SERVER_INFO = { name: "vinay-memory", version: "1.0.0", title: "vinay — garrett's personal assistant" } as const;
const INSTRUCTIONS =
  "vinay is garrett's personal assistant. Call vinay_context at session start to load state, then log commitments, decisions, and a session-end journal note as they happen. This connector is private to garrett.";

async function dispatch(rpc: JsonRpcRequest, actor: string): Promise<JsonRpcResponse | null> {
  const isNotification = rpc.id === undefined || rpc.id === null;
  const id = rpc.id ?? null;
  try {
    switch (rpc.method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2025-06-18",
            capabilities: { tools: { listChanged: false } },
            serverInfo: SERVER_INFO,
            instructions: INSTRUCTIONS,
          },
        };
      case "tools/list":
        return { jsonrpc: "2.0", id, result: { tools: VINAY_TOOLS } };
      case "tools/call": {
        const params = (rpc.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
        const r = await callVinay(params.name ?? "", params.arguments ?? {}, actor);
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  const actor = await authorizeVinay(req);
  if (actor === null) return unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: ERR.PARSE, message: "invalid JSON" } },
      { status: 400 },
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => dispatch(r as JsonRpcRequest, actor)));
    const nonNull = responses.filter((r): r is JsonRpcResponse => r !== null);
    if (nonNull.length === 0) return new NextResponse(null, { status: 204 });
    return NextResponse.json(nonNull);
  }

  const response = await dispatch(body as JsonRpcRequest, actor);
  if (response === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(response);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const actor = await authorizeVinay(req);
  if (actor === null) return unauthorized();
  return NextResponse.json({
    name: SERVER_INFO.name,
    version: SERVER_INFO.version,
    protocol: "Model Context Protocol over HTTP (JSON-RPC 2.0)",
    instructions:
      "POST JSON-RPC requests here. Auth: Bearer VINAY_API_TOKEN (Claude Code) or OAuth as garrett (Cowork). Methods: initialize, tools/list, tools/call.",
    tools_available: VINAY_TOOLS.map((t) => t.name),
  });
}
