/**
 * Voice-side tool definitions and server-side executor.
 *
 * Tools run entirely on our server between the user utterance and the agent's
 * streaming reply — Vapi never sees them. This means:
 * - Read-only tools only (no writes; voice calls don't have a review step).
 * - Max 1 tool call per turn (enforced in the route) to bound dead air.
 * - The route detects tool_use via the first content_block_start event type;
 *   text-only turns have zero added latency.
 *
 * Per-slug tool lists keep agents focused: Pam gets project + deal lookups,
 * Mo gets deal lookups, Carl gets project lookups, Fin gets deal lookups.
 * Opsy and Claude have no tools (ops data is fully in the briefing; Claude
 * is a general line with no dashboard access).
 */

import { getProjectsFromSupabase } from "@/lib/supabase/projects";
import { getDealsFromSupabase } from "@/lib/supabase/deals";
import { getRfpOpportunitiesFromSupabase } from "@/lib/supabase/rfp-opportunities";
import type { VoiceSlug } from "./assistants";

// ── tool definitions (Anthropic Tool schema) ─────────────────────────────────

export interface VoiceTool {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

const LOOKUP_PROJECTS: VoiceTool = {
  name: "lookup_projects",
  description:
    "Search the live list of active projects by name keyword. " +
    "Use when Garrett asks about a specific project's status or timeline and " +
    "your briefing doesn't have the detail. " +
    "Returns project name, status, and due date.",
  input_schema: {
    type: "object",
    properties: {
      search: {
        type: "string",
        description: "Partial project name to search (case-insensitive). Omit to return all active projects.",
      },
    },
  },
};

const LOOKUP_DEALS: VoiceTool = {
  name: "lookup_deals",
  description:
    "Search the live BD pipeline for open deals by name keyword. " +
    "Use when asked about a specific contract, proposal, or deal status that " +
    "isn't covered in your briefing. " +
    "Returns deal name, stage, and value.",
  input_schema: {
    type: "object",
    properties: {
      search: {
        type: "string",
        description: "Partial deal name to search (case-insensitive). Omit to return all open deals.",
      },
    },
  },
};

const LOOKUP_OPPORTUNITIES: VoiceTool = {
  name: "lookup_opportunities",
  description:
    "Search the live RFP pipeline for active opportunities by name keyword. " +
    "Use when asked about a specific bid, RFP, or opportunity that isn't fully " +
    "covered in your briefing. " +
    "Returns opportunity name, status, fit score, estimated value, and due date.",
  input_schema: {
    type: "object",
    properties: {
      search: {
        type: "string",
        description: "Partial opportunity name to search (case-insensitive). Omit to return all active opportunities.",
      },
    },
  },
};

// ── per-slug tool assignments ─────────────────────────────────────────────────

const SLUG_TOOLS: Record<VoiceSlug, VoiceTool[]> = {
  pam:   [LOOKUP_PROJECTS, LOOKUP_DEALS],
  cmo:   [LOOKUP_DEALS],
  carl:  [LOOKUP_PROJECTS],
  fin:   [LOOKUP_DEALS],
  opsy:  [],
  biz:   [LOOKUP_OPPORTUNITIES],
  claude: [],
};

export function getVoiceTools(slug: VoiceSlug): VoiceTool[] {
  return SLUG_TOOLS[slug] ?? [];
}

// ── server-side executor ──────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["in queue", "in progress", "under review", "suspended"]);

export async function executeVoiceTool(
  name: string,
  input: Record<string, unknown>,
): Promise<string> {
  const search = typeof input.search === "string" && input.search.trim()
    ? input.search.trim()
    : undefined;

  if (name === "lookup_projects") {
    const { data } = await getProjectsFromSupabase(
      { archive: false, search },
      { pageSize: 20 },
    );
    const live = data.filter(p => ACTIVE_STATUSES.has(p.status));
    if (!live.length) return "no matching active projects found.";
    return live.slice(0, 10).map(p => {
      const end = p.timeline?.end ? ` (due ${p.timeline.end})` : "";
      return `- [${p.status}] ${p.project}${end}`;
    }).join("\n");
  }

  if (name === "lookup_deals") {
    const deals = await getDealsFromSupabase(undefined, undefined, search);
    const open = deals.filter(d => d.stage !== "lost");
    if (!open.length) return "no matching open deals found.";
    return open.slice(0, 10).map(d => {
      const val = d.value != null && d.value > 0
        ? ` — $${Math.round(d.value).toLocaleString("en-US")}`
        : "";
      return `- [${d.stage}] ${d.deal}${val}`;
    }).join("\n");
  }

  if (name === "lookup_opportunities") {
    const BIZ_TERMINAL = new Set(["won", "lost", "no-go", "missed deadline"]);
    const { data } = await getRfpOpportunitiesFromSupabase(
      search ? { search } : {},
      { page: 1, pageSize: 30 },
    );
    const active = data.filter((o) => !BIZ_TERMINAL.has(o.status));
    if (!active.length) return "no matching active opportunities found.";
    return active.slice(0, 10).map((o) => {
      const due = o.dueDate?.start ? ` (due ${o.dueDate.start})` : "";
      const val = o.estimatedValue ? ` $${Math.round(o.estimatedValue).toLocaleString("en-US")}` : "";
      return `- [${o.status}] ${o.opportunityName}${due}${val} | fit: ${o.wvFitScore ?? "TBD"}`;
    }).join("\n");
  }

  return `unknown tool: ${name}`;
}
