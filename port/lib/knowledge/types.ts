/**
 * Knowledge-graph domain types — the canonical home for node/edge/gap shapes.
 *
 * `graph-data.ts` is the committed snapshot (just the const); it imports these.
 * The live data layer (`supabase.ts`) and ingestion both produce this shape.
 *
 * Provenance is two axes:
 *  - `kind`   — actor: human | agent | shared (drives colour)
 *  - `source` — origin: notion-cv | agent-log | curated | derived (back-traversal)
 *
 * `kind`, `source`, `canonicalKey`, `lastSeenAt` are OPTIONAL so the legacy
 * curated const (which omits them) still satisfies GraphNode unchanged.
 */

// ── actors / provenance ──────────────────────────────────────
export type AgentId = "mo" | "carl" | "pam" | "opsy" | "biz" | "fin" | "shared";
export type NodeKind = "human" | "agent" | "shared";
export type NodeSource = "notion-cv" | "agent-log" | "curated" | "derived";

export type NodeCategory =
  // agent-graph categories (curated)
  | "agent"
  | "organisation"
  | "product"
  | "platform"
  | "project"
  | "person"
  | "service"
  | "client"
  | "partner"
  | "research-domain"
  | "research-program"
  | "concept"
  | "tool"
  | "channel"
  | "audience"
  | "strategy"
  | "competitor"
  // human CV-graph categories
  | "member"
  | "skill"
  | "method"
  | "framework"
  | "population"
  | "cv-entry";

export interface GraphNode {
  id: string;
  label: string;
  agent: AgentId;
  category: NodeCategory;
  description: string;
  /** actor axis — present on live data, omitted on the curated const */
  kind?: NodeKind;
  source?: NodeSource;
  /** normalized label for cross-source reconciliation */
  canonicalKey?: string;
  /** ISO timestamp of the last sync that saw this node (staleness signal) */
  lastSeenAt?: string;
  /** filtering/styling payload — category, family, visibility, dates, status, … */
  attrs?: Record<string, unknown>;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationship: string;
  kind?: NodeSource;
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ── gap analysis ─────────────────────────────────────────────
export type GapType =
  // existing concept-scaffold detectors
  | "isolated"
  | "shallow-research"
  | "ungrounded-product"
  | "thin-bridge"
  | "no-methodology"
  // new cross-graph (human ↔ agent) detectors
  | "capability-gap"
  | "claimed-unevidenced"
  | "evidence-asymmetry"
  | "framework-adoption"
  | "population-coverage"
  | "service-coverage";

export interface Gap {
  type: GapType;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  nodeIds: string[];
  /** what cARL should study to close this gap */
  curriculumSuggestion?: string;
}

// ── styling ──────────────────────────────────────────────────
export const AGENT_META: Record<AgentId, { color: string; light: string; label: string }> = {
  mo:     { color: "#3b82f6", light: "#93c5fd", label: "Mo (CMO)" },
  carl:   { color: "#10b981", light: "#6ee7b7", label: "cARL (research)" },
  pam:    { color: "#f59e0b", light: "#fcd34d", label: "PaM (PM)" },
  opsy:   { color: "#ef4444", light: "#fca5a5", label: "Opsy (ops)" },
  biz:    { color: "#8b5cf6", light: "#c4b5fd", label: "Biz (BD)" },
  fin:    { color: "#ec4899", light: "#f9a8d4", label: "Fin (CFO)" },
  shared: { color: "#6b7280", light: "#d1d5db", label: "shared" },
};

/** Provenance colours — the human ↔ agent ↔ shared axis. */
export const PROVENANCE_META: Record<NodeKind, { color: string; light: string; label: string }> = {
  human:  { color: "#0d9488", light: "#5eead4", label: "human (CV)" },
  agent:  { color: "#6b7280", light: "#d1d5db", label: "agent" },
  shared: { color: "#eab308", light: "#fde047", label: "shared" },
};

/**
 * Node colour: provenance-first (human teal, shared gold), falling back to the
 * per-agent colour for agent / curated nodes so you still see which agent owns it.
 */
export function getNodeColor(node: Pick<GraphNode, "kind" | "agent">): string {
  if (node.kind === "human") return PROVENANCE_META.human.color;
  if (node.kind === "shared") return PROVENANCE_META.shared.color;
  return AGENT_META[node.agent]?.color ?? PROVENANCE_META.agent.color;
}

// ── reconciliation / recency ─────────────────────────────────
/** The categories that form the "proposal-facing" default view. */
export const PROPOSAL_FACING: ReadonlySet<NodeCategory> = new Set<NodeCategory>([
  "member", "skill", "method", "framework", "agent",
]);

/** A skill/framework is "stale" with no demonstrating evidence in this window. */
export const STALE_MONTHS = 24;
/** Service exemplars are "strong" only within this window. */
export const SERVICE_RECENCY_YEARS = 5;

/**
 * Normalize a label into a reconciliation key: lowercase, strip punctuation,
 * collapse whitespace. Used to match a human "Psychometric Validation" skill
 * against an agent-referenced "psychometric validation" concept.
 */
export function canonicalKey(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
