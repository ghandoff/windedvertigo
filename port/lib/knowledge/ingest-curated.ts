/**
 * Curated seed — the hand-authored 131-node const becomes the third graph
 * source (`source: curated`). Agent-category nodes are namespaced to
 * `agent:<id>` so the live agent-log actor nodes upsert onto the same row.
 */

import { GRAPH_DATA } from "./graph-data";
import { canonicalKey } from "./types";
import type { NodeInput, EdgeInput } from "./supabase";

/** map a curated id to its graph id (agent nodes → "agent:<slug>").
 * Strips any existing agent: prefix chain before re-applying one, so the
 * function is idempotent regardless of how many layers the snapshot already has.
 */
function curatedId(id: string, isAgent: boolean): string {
  if (!isAgent) return id;
  const slug = id.replace(/^(agent:)+/, "");
  return `agent:${slug}`;
}

export function curatedGraphInputs(): { nodes: NodeInput[]; edges: EdgeInput[] } {
  const agentIds = new Set(GRAPH_DATA.nodes.filter((n) => n.category === "agent").map((n) => n.id));

  // Deduplicate by canonical id — the stale snapshot may have multiple nesting
  // depths for the same agent node (e.g. agent:agent:carl AND agent:carl). Last
  // entry wins, which is fine: all duplicates carry the same label/description.
  const nodeMap = new Map<string, NodeInput>();
  for (const n of GRAPH_DATA.nodes) {
    const id = curatedId(n.id, n.category === "agent");
    nodeMap.set(id, {
      id,
      kind: "agent",
      category: n.category,
      label: n.label,
      canonicalKey: canonicalKey(n.label),
      source: "curated",
      sourceRef: "const",
      description: n.description,
      attrs: { agent: n.agent, category: n.category },
    });
  }

  // Deduplicate edges by (sourceId, targetId, relationship) — same constraint as
  // the DB unique index, so a batch can't conflict with itself.
  const edgeMap = new Map<string, EdgeInput>();
  for (const e of GRAPH_DATA.edges) {
    const sourceId = curatedId(e.source, agentIds.has(e.source));
    const targetId = curatedId(e.target, agentIds.has(e.target));
    const key = `${sourceId}|${targetId}|${e.relationship}`;
    edgeMap.set(key, { sourceId, targetId, relationship: e.relationship, source: "curated" });
  }

  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}
