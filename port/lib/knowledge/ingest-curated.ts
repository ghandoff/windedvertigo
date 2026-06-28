/**
 * Curated seed — the hand-authored 131-node const becomes the third graph
 * source (`source: curated`). Agent-category nodes are namespaced to
 * `agent:<id>` so the live agent-log actor nodes upsert onto the same row.
 */

import { GRAPH_DATA } from "./graph-data";
import { canonicalKey } from "./types";
import type { NodeInput, EdgeInput } from "./supabase";

/** map a curated id to its graph id (agent nodes → "agent:<id>") */
function curatedId(id: string, isAgent: boolean): string {
  return isAgent ? `agent:${id}` : id;
}

export function curatedGraphInputs(): { nodes: NodeInput[]; edges: EdgeInput[] } {
  const agentIds = new Set(GRAPH_DATA.nodes.filter((n) => n.category === "agent").map((n) => n.id));

  const nodes: NodeInput[] = GRAPH_DATA.nodes.map((n) => ({
    id: curatedId(n.id, n.category === "agent"),
    kind: "agent",
    category: n.category,
    label: n.label,
    canonicalKey: canonicalKey(n.label),
    source: "curated",
    sourceRef: "const",
    description: n.description,
    attrs: { agent: n.agent, category: n.category },
  }));

  const edges: EdgeInput[] = GRAPH_DATA.edges.map((e) => ({
    sourceId: curatedId(e.source, agentIds.has(e.source)),
    targetId: curatedId(e.target, agentIds.has(e.target)),
    relationship: e.relationship,
    source: "curated",
  }));

  return { nodes, edges };
}
