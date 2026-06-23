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
import { getPamDecisions, getPamMemory } from "@/lib/supabase/pam";
import { getCmoDecisions, getCmoMemory } from "@/lib/supabase/cmo";
import { getCarlDecisions, getCarlMemory } from "@/lib/supabase/carl";
import { getOpsyDecisions, getOpsyMemory } from "@/lib/supabase/opsy";
import { getRecentDecisions, getFinMemory } from "@/lib/fin-data";
import { getRecentBizDecisions, getBizMemory } from "@/lib/biz-data";
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

const RECALL_MEMORY: VoiceTool = {
  name: "recall_memory",
  description:
    "Search your own long-term memory — your working-state notes and the full " +
    "history of past conversations and decisions — by keyword. Your briefing " +
    "only covers the last 14 days; use this when Garrett refers to something " +
    "older, asks 'what did we decide about X', 'do you remember Y', or 'have we " +
    "talked about Z before', and it isn't in your briefing. " +
    "Returns matching memory notes and dated past conversations.",
  input_schema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "A topic or keyword to search your memory for (e.g. a person, project, decision, or theme).",
      },
    },
    required: ["query"],
  },
};

// ── per-slug tool assignments ─────────────────────────────────────────────────
// Every agent with a Supabase memory layer gets recall_memory; the memory-less
// Claude line does not.

const SLUG_TOOLS: Record<VoiceSlug, VoiceTool[]> = {
  pam:   [LOOKUP_PROJECTS, LOOKUP_DEALS, RECALL_MEMORY],
  cmo:   [LOOKUP_DEALS, RECALL_MEMORY],
  carl:  [LOOKUP_PROJECTS, RECALL_MEMORY],
  fin:   [LOOKUP_DEALS, RECALL_MEMORY],
  opsy:  [RECALL_MEMORY],
  biz:   [LOOKUP_OPPORTUNITIES, RECALL_MEMORY],
  claude: [],
};

export function getVoiceTools(slug: VoiceSlug): VoiceTool[] {
  return SLUG_TOOLS[slug] ?? [];
}

// ── memory recall ─────────────────────────────────────────────────────────────
// Normalise each agent's memory + decision history into one shape, then keyword-
// filter across the FULL history (the briefing only carries the last 14 days).

interface NormalizedMemory {
  memory: { key: string; value: string }[];
  entries: { date: string; who?: string; text: string; sub: string[] }[];
}

// Standard agents (pam/cmo/carl/opsy): {created_at, who, summary, decisions[]}.
const stdEntry = (d: { created_at: string; who?: string; summary: string; decisions?: string[] | null }) => ({
  date: d.created_at.slice(0, 10),
  who: d.who,
  text: d.summary,
  sub: d.decisions ?? [],
});
// fin/biz decisions: {created_at, decision, context}.
const ledgerEntry = (d: { created_at?: string | null; decision: string; context?: string | null }) => ({
  date: String(d.created_at ?? "").slice(0, 10),
  text: d.decision,
  sub: d.context ? [d.context] : [],
});

const MEMORY_LOADERS: Record<Exclude<VoiceSlug, "claude">, () => Promise<NormalizedMemory>> = {
  pam: async () => {
    const [memory, d] = await Promise.all([getPamMemory(), getPamDecisions({ limit: 200 })]);
    return { memory, entries: d.map(stdEntry) };
  },
  cmo: async () => {
    const [memory, d] = await Promise.all([getCmoMemory(), getCmoDecisions({ limit: 200 })]);
    return { memory, entries: d.map(stdEntry) };
  },
  carl: async () => {
    const [memory, d] = await Promise.all([getCarlMemory(), getCarlDecisions({ limit: 200 })]);
    return { memory, entries: d.map(stdEntry) };
  },
  opsy: async () => {
    const [memory, d] = await Promise.all([getOpsyMemory(), getOpsyDecisions({ limit: 200 })]);
    return { memory, entries: d.map(stdEntry) };
  },
  fin: async () => {
    const [memory, d] = await Promise.all([getFinMemory(), getRecentDecisions(100)]);
    return { memory, entries: d.map(ledgerEntry) };
  },
  biz: async () => {
    const [memory, d] = await Promise.all([getBizMemory(), getRecentBizDecisions(100)]);
    return { memory, entries: d.map(ledgerEntry) };
  },
};

async function recallMemory(slug: VoiceSlug, query: string): Promise<string> {
  const q = query.trim().toLowerCase();
  if (!q) return "give me a keyword or topic and I'll search my memory.";

  const loader = (MEMORY_LOADERS as Record<string, (() => Promise<NormalizedMemory>) | undefined>)[slug];
  if (!loader) return "this line doesn't have a searchable memory.";

  const { memory, entries } = await loader();
  const memHits = memory
    .filter((m) => `${m.key} ${m.value}`.toLowerCase().includes(q))
    .slice(0, 8);
  const entryHits = entries
    .filter((e) => `${e.text} ${e.sub.join(" ")}`.toLowerCase().includes(q))
    .slice(0, 8);

  if (!memHits.length && !entryHits.length) {
    return `I don't have anything in my memory about "${query}".`;
  }

  const out: string[] = [];
  if (memHits.length) {
    out.push("working memory:");
    for (const m of memHits) out.push(`- ${m.key}: ${m.value}`);
  }
  if (entryHits.length) {
    if (out.length) out.push("");
    out.push("past conversations & decisions:");
    for (const e of entryHits) {
      out.push(`- ${e.date}${e.who ? ` · ${e.who}` : ""}: ${e.text}`);
      for (const s of e.sub) out.push(`  · ${s}`);
    }
  }
  return out.join("\n");
}

// ── server-side executor ──────────────────────────────────────────────────────

const ACTIVE_STATUSES = new Set(["in queue", "in progress", "under review", "suspended"]);

export async function executeVoiceTool(
  name: string,
  input: Record<string, unknown>,
  slug: VoiceSlug,
): Promise<string> {
  if (name === "recall_memory") {
    const query = typeof input.query === "string" ? input.query : "";
    return recallMemory(slug, query);
  }

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
