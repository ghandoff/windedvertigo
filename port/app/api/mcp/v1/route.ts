/**
 * POST /api/mcp/v1 — Model Context Protocol server for the port.
 *
 * Exposes wv-claw's read-only tool surface (queryCampaigns, queryDeals,
 * queryRfpOpportunities, queryProjects, queryMembers, queryMeetings,
 * getMeetingActions, readStrategyDoc, etc.) to MCP-aware clients (Cowork,
 * Claude Code) so they can query the same port data the agent does.
 *
 * Auth: Bearer PORT_MCP_TOKEN (single shared secret for now — sufficient
 * for personal/team Cowork + Claude Code integrations). Token in
 * Authorization: Bearer <token> header on every JSON-RPC call.
 *
 * Protocol: minimal MCP-over-HTTP. Implements JSON-RPC 2.0 with these
 * methods:
 *   - initialize   → handshake + capabilities advertisement
 *   - tools/list   → returns read-only tool catalog
 *   - tools/call   → invokes a tool via lib/agent/tools/executor
 *
 * Notifications (initialized, cancelled) accepted and acknowledged.
 *
 * Writes are intentionally NOT exposed in v1. Writes via MCP need stronger
 * auth + confirmation flow than a single shared token gives us; defer to
 * wv-claw's confirm-gated flow for writes until that's designed.
 */

import { NextRequest, NextResponse } from "next/server";
import { AGENT_TOOLS, type AgentToolDefinition } from "@/lib/agent/tools/definitions";
import { executeTool } from "@/lib/agent/tools/executor";
import type { AgentToolName, UserScope } from "@/lib/agent/types";
import { PORT_DB } from "@/lib/notion/client";

export const maxDuration = 60;

// ── Tool whitelist (read-only subset) ─────────────────────────────────────

// All read-side tool names. Mirrors lib/agent/tools/executor switch
// cases that don't stage a write or require confirmation.
const READ_ONLY_TOOLS: AgentToolName[] = [
  "queryCampaigns",
  "getOrganization",
  "queryActivities",
  "queryContacts",
  "queryDeals",
  "queryRfpOpportunities",
  "queryProjects",
  "queryTimesheets",
  "queryWorkItems",
  "queryEvents",
  "queryMembers",
  "queryMeetings",
  "getMeetingActions",
  "readStrategyDoc",
];

const READ_ONLY_SET: ReadonlySet<AgentToolName> = new Set(READ_ONLY_TOOLS);

// Synthetic scope passed to executeTool. Authenticated via the bearer
// token at the route level; per-tool authorization handled here by the
// READ_ONLY_TOOLS whitelist.
const MCP_SERVICE_SCOPE: UserScope = {
  authEmail: "mcp-service@wv-port.internal",
  displayName: "MCP",
  allowedTools: READ_ONLY_TOOLS,
  notionContext: {
    campaignsDbId: PORT_DB.campaigns,
    socialPlanDbId: null,
    organizationsDbId: PORT_DB.organizations,
    contactsDbId: PORT_DB.contacts,
  },
};

// ── JSON-RPC types ────────────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponseSuccess {
  jsonrpc: "2.0";
  id: string | number | null;
  result: unknown;
}

interface JsonRpcResponseError {
  jsonrpc: "2.0";
  id: string | number | null;
  error: { code: number; message: string; data?: unknown };
}

type JsonRpcResponse = JsonRpcResponseSuccess | JsonRpcResponseError;

const JSONRPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
} as const;

// ── Auth ──────────────────────────────────────────────────────────────────

function verifyBearer(req: NextRequest): boolean {
  const token = process.env.PORT_MCP_TOKEN;
  if (!token) {
    console.warn("[mcp] PORT_MCP_TOKEN not set — rejecting all requests");
    return false;
  }
  const auth = req.headers.get("authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return false;
  // Constant-time compare to avoid timing side channels on token guessing.
  const provided = auth.slice(7);
  if (provided.length !== token.length) return false;
  let mismatch = 0;
  for (let i = 0; i < provided.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ token.charCodeAt(i);
  }
  return mismatch === 0;
}

// ── MCP method handlers ───────────────────────────────────────────────────

function handleInitialize(): unknown {
  // Capabilities we support. tools=true means we expose tools/list +
  // tools/call. resources=false (not in v1).
  return {
    protocolVersion: "2025-06-18",
    capabilities: {
      tools: { listChanged: false },
    },
    serverInfo: {
      name: "wv-port-mcp",
      version: "0.1.0",
      title: "Winded Vertigo Port",
    },
    instructions:
      "Read-only access to the wv-port data layer (campaigns, deals, RFP opportunities, projects, meetings, action items, members, contacts, activities, work items, timesheets, events, strategy doc sections). Call tools/list to see the full catalog. Writes are not available via MCP — for those, use the wv-claw Slack agent which has confirm-gated flows.",
  };
}

/** Convert wv-claw AGENT_TOOLS read entries → MCP tool descriptors. */
function buildMcpToolList(): unknown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tools = AGENT_TOOLS.filter((t) => READ_ONLY_SET.has(t.name as AgentToolName)).map(
    (t: AgentToolDefinition) => ({
      name: t.name,
      description: t.description,
      // MCP uses camelCase `inputSchema`; Anthropic SDK uses snake_case
      // `input_schema`. Same shape underneath.
      inputSchema: t.input_schema,
    }),
  );
  return { tools };
}

async function handleToolCall(params: Record<string, unknown>): Promise<unknown> {
  const name = typeof params.name === "string" ? params.name : "";
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  if (!READ_ONLY_SET.has(name as AgentToolName)) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `tool '${name}' is not available via MCP. Available: ${READ_ONLY_TOOLS.join(", ")}`,
        },
      ],
    };
  }
  const tool_use_id = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const result = await executeTool(
    { tool_use_id, name, input: args },
    MCP_SERVICE_SCOPE,
  );
  return {
    isError: result.is_error,
    content: [{ type: "text", text: result.content }],
  };
}

// ── Dispatcher ────────────────────────────────────────────────────────────

async function dispatch(rpc: JsonRpcRequest): Promise<JsonRpcResponse | null> {
  // Notifications (no id) — accept and don't respond per JSON-RPC spec.
  const isNotification = rpc.id === undefined || rpc.id === null;
  const id = rpc.id ?? null;

  try {
    switch (rpc.method) {
      case "initialize":
        return { jsonrpc: "2.0", id, result: handleInitialize() };

      case "tools/list":
        return { jsonrpc: "2.0", id, result: buildMcpToolList() };

      case "tools/call":
        return {
          jsonrpc: "2.0",
          id,
          result: await handleToolCall((rpc.params ?? {}) as Record<string, unknown>),
        };

      case "notifications/initialized":
      case "notifications/cancelled":
      case "ping":
        // No-op for notifications; ping returns empty result.
        if (isNotification) return null;
        return { jsonrpc: "2.0", id, result: {} };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: JSONRPC_ERRORS.METHOD_NOT_FOUND,
            message: `method '${rpc.method}' not implemented`,
          },
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.warn(`[mcp] handler for ${rpc.method} threw:`, message);
    return {
      jsonrpc: "2.0",
      id,
      error: { code: JSONRPC_ERRORS.INTERNAL_ERROR, message },
    };
  }
}

// ── HTTP handlers ─────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!verifyBearer(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Parse JSON-RPC body. Accept both single requests and batched arrays
  // per JSON-RPC 2.0 spec.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: JSONRPC_ERRORS.PARSE_ERROR, message: "invalid JSON" },
      },
      { status: 400 },
    );
  }

  // Batch
  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((r) => dispatch(r as JsonRpcRequest)));
    const nonNull = responses.filter((r): r is JsonRpcResponse => r !== null);
    // Per spec, return empty body for all-notification batches.
    if (nonNull.length === 0) return new NextResponse(null, { status: 204 });
    return NextResponse.json(nonNull);
  }

  // Single
  const response = await dispatch(body as JsonRpcRequest);
  if (response === null) return new NextResponse(null, { status: 204 });
  return NextResponse.json(response);
}

/** Tiny GET handler so curling the URL returns a helpful banner instead of 405. */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    name: "wv-port-mcp",
    version: "0.1.0",
    protocol: "Model Context Protocol over HTTP (JSON-RPC 2.0)",
    instructions:
      "POST JSON-RPC requests to this URL with Authorization: Bearer <PORT_MCP_TOKEN>. Methods: initialize, tools/list, tools/call.",
    tools_available: READ_ONLY_TOOLS,
  });
}
