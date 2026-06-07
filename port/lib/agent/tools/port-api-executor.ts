/**
 * Port API executor for Mo / PaM / cARL agent tools.
 *
 * Routes tool calls from the agent loop to the appropriate memory API
 * endpoints on the port. All calls are server-to-server within the same
 * deployment, authenticated with CMO_API_TOKEN.
 *
 * Returns a JSON-stringified result (success) or error message — the same
 * contract as the existing executeTool() in executor.ts.
 *
 * Never throws — errors are returned as JSON strings so the agent loop
 * stays alive and can tell the user something went wrong.
 */

import type { ToolResult } from "./executor";

const BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://port.windedvertigo.com";

function authHeaders() {
  return {
    Authorization: `Bearer ${process.env.CMO_API_TOKEN ?? ""}`,
    "Content-Type": "application/json",
  };
}

async function portGet(
  path: string,
  params?: Record<string, string>,
): Promise<string> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v) url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`GET ${path} returned ${res.status}`);
  return JSON.stringify(await res.json());
}

async function portPost(
  path: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
): Promise<string> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} returned ${res.status}`);
  return JSON.stringify(await res.json());
}

async function portPatch(
  path: string,
  params: Record<string, string>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  body: Record<string, any>,
): Promise<string> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v) url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString(), {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} returned ${res.status}`);
  return JSON.stringify(await res.json());
}

/**
 * Execute a named agent API tool call (Mo / PaM / cARL tools only).
 * Returns a ToolResult ready to pass back to Claude.
 */
export async function executeAgentApiTool(request: {
  tool_use_id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  input: Record<string, any>;
}): Promise<ToolResult> {
  const { tool_use_id, name, input } = request;

  try {
    let content: string;

    switch (name) {
      // ── Mo tools ─────────────────────────────────────────────────────────

      case "cmo_log_decision":
        content = await portPost("/api/cmo/decisions", {
          who: String(input.who ?? ""),
          summary: String(input.summary ?? ""),
          decisions: Array.isArray(input.decisions) ? input.decisions : [],
          tags: Array.isArray(input.tags) ? input.tags : [],
          session_type: input.session_type ?? "web",
        });
        break;

      case "cmo_update_memory":
        content = await portPost("/api/cmo/memory", {
          key: String(input.key ?? ""),
          value: String(input.value ?? ""),
          updated_by: input.updated_by ?? "mo",
        });
        break;

      // ── PaM tools ────────────────────────────────────────────────────────

      case "pam_log_decision":
        content = await portPost("/api/pam/decisions", {
          who: String(input.who ?? ""),
          summary: String(input.summary ?? ""),
          decisions: Array.isArray(input.decisions) ? input.decisions : [],
          tags: Array.isArray(input.tags) ? input.tags : [],
          session_type: input.session_type ?? "web",
        });
        break;

      case "pam_update_memory":
        content = await portPost("/api/pam/memory", {
          key: String(input.key ?? ""),
          value: String(input.value ?? ""),
          updated_by: input.updated_by ?? "pam",
        });
        break;

      case "pam_create_commitment":
        content = await portPost("/api/pam/commitments", {
          who: String(input.who ?? ""),
          what: String(input.what ?? ""),
          due_date: input.due_date ?? undefined,
          start_date: input.start_date ?? undefined,
          source: input.source ?? undefined,
          depends_on: input.depends_on ?? undefined,
        });
        break;

      case "pam_update_commitment": {
        const id = String(input.id ?? "").trim();
        if (!id) throw new Error("pam_update_commitment: missing 'id'");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updates: Record<string, any> = {};
        if (input.status !== undefined) updates.status = input.status;
        if (input.blocker !== undefined) updates.blocker = input.blocker;
        if (input.what !== undefined) updates.what = input.what;
        if (input.due_date !== undefined) updates.due_date = input.due_date;
        content = await portPatch("/api/pam/commitments", { id }, updates);
        break;
      }

      case "pam_list_commitments":
        content = await portGet("/api/pam/commitments", {
          who: input.who ?? "",
          status: input.status ?? "",
        });
        break;

      // ── cARL tools ───────────────────────────────────────────────────────

      case "carl_log_decision":
        content = await portPost("/api/carl/decisions", {
          who: String(input.who ?? ""),
          summary: String(input.summary ?? ""),
          decisions: Array.isArray(input.decisions) ? input.decisions : [],
          tags: Array.isArray(input.tags) ? input.tags : [],
          session_type: input.session_type ?? "web",
        });
        break;

      case "carl_update_memory":
        content = await portPost("/api/carl/memory", {
          key: String(input.key ?? ""),
          value: String(input.value ?? ""),
          updated_by: input.updated_by ?? "carl",
        });
        break;

      case "carl_add_finding":
        content = await portPost("/api/carl/findings", {
          domain: String(input.domain ?? ""),
          title: String(input.title ?? ""),
          summary: String(input.summary ?? ""),
          source: input.source ?? undefined,
          citation: input.citation ?? undefined,
          relevance: input.relevance ?? undefined,
          tags: Array.isArray(input.tags) ? input.tags : [],
          connected_to: input.connected_to ?? undefined,
        });
        break;

      case "carl_search_findings":
        content = await portGet("/api/carl/findings", {
          domain: input.domain ?? "",
          tags: input.tags ?? "",
          search: input.search ?? "",
        });
        break;

      case "carl_curriculum":
        content = await portGet("/api/carl/curriculum");
        break;

      case "carl_add_curriculum_topic":
        content = await portPost("/api/carl/curriculum", {
          domain: String(input.domain ?? ""),
          topic: String(input.topic ?? ""),
          key_works: Array.isArray(input.key_works) ? input.key_works : [],
          priority: typeof input.priority === "number" ? input.priority : 2,
          notes: input.notes ?? undefined,
        });
        break;

      default:
        return {
          tool_use_id,
          content: `Error: unknown agent tool '${name}'`,
          is_error: true,
        };
    }

    return { tool_use_id, content, is_error: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : "agent tool call failed";
    console.warn(`[agent/port-api] ${name} failed:`, message);
    return {
      tool_use_id,
      content: `Error: ${message}`,
      is_error: true,
    };
  }
}
