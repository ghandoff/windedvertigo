/**
 * Live read/write layer for the knowledge graph (knowledge_nodes / knowledge_edges).
 *
 * `fetchGraphData()` is what /brain renders (with the const snapshot as fallback).
 * `upsertNodes` / `upsertEdges` are idempotent — re-running a sync updates rows
 * and bumps `last_seen_at`; it never duplicates. `first_seen_at` is omitted from
 * the payload so PostgREST preserves it across updates.
 */

import { supabase } from "@/lib/supabase/client";
import {
  type GraphData,
  type GraphNode,
  type GraphEdge,
  type NodeKind,
  type NodeSource,
  type NodeCategory,
  type AgentId,
} from "./types";

// ── row shapes ───────────────────────────────────────────────
interface NodeRow {
  id: string;
  kind: NodeKind;
  category: NodeCategory;
  label: string;
  canonical_key: string;
  source: NodeSource;
  source_ref: string | null;
  description: string | null;
  attrs: Record<string, unknown> | null;
  last_seen_at: string;
}

interface EdgeRow {
  source_id: string;
  target_id: string;
  relationship: string;
  source: NodeSource;
  attrs: Record<string, unknown> | null;
}

// ── inputs (ingestion produces these) ────────────────────────
export interface NodeInput {
  id: string;
  kind: NodeKind;
  category: NodeCategory;
  label: string;
  canonicalKey: string;
  source: NodeSource;
  sourceRef?: string | null;
  description?: string | null;
  attrs?: Record<string, unknown>;
}

export interface EdgeInput {
  sourceId: string;
  targetId: string;
  relationship: string;
  source: NodeSource;
  sourceRef?: string | null;
  attrs?: Record<string, unknown>;
}

export interface UpsertCounts {
  added: number;
  updated: number;
}

const VALID_KIND = (k: string): AgentId =>
  (["mo", "carl", "pam", "opsy", "biz", "fin"].includes(k) ? k : "shared") as AgentId;

function rowToNode(r: NodeRow): GraphNode {
  const attrs = r.attrs ?? {};
  const agent = typeof attrs.agent === "string" ? VALID_KIND(attrs.agent) : "shared";
  return {
    id: r.id,
    label: r.label,
    agent,
    category: r.category,
    description: r.description ?? "",
    kind: r.kind,
    source: r.source,
    canonicalKey: r.canonical_key,
    lastSeenAt: r.last_seen_at,
    attrs,
  };
}

/**
 * Read the entire graph for /brain. Returns null if the table is empty or
 * unreachable so the caller can fall back to the committed const snapshot.
 */
/** Paginate past PostgREST's 1000-row default so large graphs read in full. */
export async function selectAll<T>(table: string, cols: string): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from(table).select(cols).range(from, from + 999);
    if (error) throw error;
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < 1000) break;
  }
  return out;
}

export async function fetchGraphData(): Promise<GraphData | null> {
  try {
    const [nodeRows, edgeRows] = await Promise.all([
      selectAll<NodeRow>(
        "knowledge_nodes",
        "id, kind, category, label, canonical_key, source, source_ref, description, attrs, last_seen_at",
      ),
      selectAll<EdgeRow>("knowledge_edges", "source_id, target_id, relationship, source, attrs"),
    ]);
    if (nodeRows.length === 0) return null;

    const nodes = nodeRows.map(rowToNode);
    const validIds = new Set(nodes.map((n) => n.id));
    const edges: GraphEdge[] = edgeRows
      // drop dangling edges defensively (FK should prevent, but be safe for the sim)
      .filter((e) => validIds.has(e.source_id) && validIds.has(e.target_id))
      .map((e) => ({ source: e.source_id, target: e.target_id, relationship: e.relationship, kind: e.source }));

    return { nodes, edges };
  } catch (err) {
    console.error("[knowledge/supabase] fetchGraphData failed, falling back to snapshot:", err);
    return null;
  }
}

/** Upsert nodes by id; bump last_seen_at; report added vs updated. */
export async function upsertNodes(inputs: NodeInput[], syncTs: string): Promise<UpsertCounts> {
  if (inputs.length === 0) return { added: 0, updated: 0 };

  const ids = inputs.map((n) => n.id);
  const existing = new Set<string>();
  for (let i = 0; i < ids.length; i += 500) {
    const { data } = await supabase
      .from("knowledge_nodes")
      .select("id")
      .in("id", ids.slice(i, i + 500));
    (data ?? []).forEach((r: { id: string }) => existing.add(r.id));
  }

  const payload = inputs.map((n) => ({
    id: n.id,
    kind: n.kind,
    category: n.category,
    label: n.label,
    canonical_key: n.canonicalKey,
    source: n.source,
    source_ref: n.sourceRef ?? null,
    description: n.description ?? null,
    attrs: n.attrs ?? {},
    last_seen_at: syncTs,
    updated_at: syncTs,
  }));

  for (let i = 0; i < payload.length; i += 500) {
    const { error } = await supabase
      .from("knowledge_nodes")
      .upsert(payload.slice(i, i + 500), { onConflict: "id" });
    if (error) throw new Error(`[knowledge/supabase] upsertNodes: ${error.message}`);
  }

  const added = inputs.filter((n) => !existing.has(n.id)).length;
  return { added, updated: inputs.length - added };
}

/** Upsert edges by the (source_id, target_id, relationship, source) unique tuple. */
export async function upsertEdges(inputs: EdgeInput[], syncTs: string): Promise<UpsertCounts> {
  if (inputs.length === 0) return { added: 0, updated: 0 };

  const payload = inputs.map((e) => ({
    source_id: e.sourceId,
    target_id: e.targetId,
    relationship: e.relationship,
    source: e.source,
    source_ref: e.sourceRef ?? null,
    attrs: e.attrs ?? {},
    last_seen_at: syncTs,
    updated_at: syncTs,
  }));

  let touched = 0;
  for (let i = 0; i < payload.length; i += 500) {
    const slice = payload.slice(i, i + 500);
    const { error } = await supabase
      .from("knowledge_edges")
      .upsert(slice, { onConflict: "source_id,target_id,relationship,source", ignoreDuplicates: false });
    if (error) throw new Error(`[knowledge/supabase] upsertEdges: ${error.message}`);
    touched += slice.length;
  }
  // edges have no cheap added/updated split; report the total touched as "added".
  return { added: touched, updated: 0 };
}

/**
 * Drop agent-log concept nodes not seen in the latest run (regenerated each
 * sync). Edges cascade. Skips `shared` nodes (they have a human counterpart)
 * and anything from notion-cv / curated.
 */
export async function pruneStaleNodes(syncTs: string): Promise<number> {
  const { data, error } = await supabase
    .from("knowledge_nodes")
    .delete()
    .eq("source", "agent-log")
    .in("category", ["concept", "literature"])
    .eq("kind", "agent")
    .lt("last_seen_at", syncTs)
    .select("id");
  if (error) throw new Error(`[knowledge/supabase] pruneStaleNodes: ${error.message}`);
  return (data ?? []).length;
}

/**
 * Delete all edges from a given node with a specific relationship.
 * Used by the adjudicator to remove the old `fed-into` edge before
 * inserting a corrected one with source: "adjudicator".
 */
export async function deleteEdgesFromNode(nodeId: string, relationship: string): Promise<void> {
  const { error } = await supabase
    .from("knowledge_edges")
    .delete()
    .eq("source_id", nodeId)
    .eq("relationship", relationship);
  if (error) throw new Error(`[knowledge/supabase] deleteEdgesFromNode: ${error.message}`);
}

/**
 * Fetch a node, JSON-merge the patch into its `attrs`, and upsert back.
 * Preserves any attrs fields not mentioned in the patch (incl. fields set
 * by prior adjudicator edits). Throws if the node doesn't exist.
 */
export async function patchNodeAttrs(nodeId: string, patch: Record<string, unknown>): Promise<void> {
  const { data, error } = await supabase
    .from("knowledge_nodes")
    .select("attrs")
    .eq("id", nodeId)
    .single();
  if (error) throw new Error(`[knowledge/supabase] patchNodeAttrs fetch: ${error.message}`);
  const merged = { ...(data.attrs ?? {}), ...patch };
  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from("knowledge_nodes")
    .update({ attrs: merged, updated_at: now })
    .eq("id", nodeId);
  if (upErr) throw new Error(`[knowledge/supabase] patchNodeAttrs update: ${upErr.message}`);
}

/** Drop edges whose endpoints no longer exist (after a sync), keeping the graph clean. */
export async function pruneDanglingEdges(): Promise<number> {
  const nodeIds = await selectAll<{ id: string }>("knowledge_nodes", "id");
  const valid = new Set(nodeIds.map((r) => r.id));
  const edges = await selectAll<{ id: string; source_id: string; target_id: string }>(
    "knowledge_edges",
    "id, source_id, target_id",
  );
  const dangling = edges
    .filter((e) => !valid.has(e.source_id) || !valid.has(e.target_id))
    .map((e) => e.id);
  for (let i = 0; i < dangling.length; i += 500) {
    await supabase.from("knowledge_edges").delete().in("id", dangling.slice(i, i + 500));
  }
  return dangling.length;
}
