/**
 * Reconciliation — the merge step.
 *
 * Wherever a human node (a CV skill/framework/method/member) and a non-human
 * node (an agent-observed concept, or the curated scaffold) share a
 * `canonical_key`, they describe the same thing. We:
 *   - write a `same-as` edge (source: derived) between them — the visible
 *     human↔agent bridge, the payoff of the merge; and
 *   - mark both nodes `kind: shared` so the viz colours them as merge points.
 *
 * Non-destructive: both source rows + their provenance survive. Runs after both
 * ingests have upserted, reading the live table so it sees every source.
 */

import { supabase } from "@/lib/supabase/client";
import { upsertEdges, selectAll, type EdgeInput } from "./supabase";

interface MiniNode {
  id: string;
  kind: "human" | "agent" | "shared";
  canonical_key: string;
}

export interface ReconcileResult {
  bridges: number;
  sharedNodes: number;
}

export async function reconcile(syncTs: string): Promise<ReconcileResult> {
  const nodes = await selectAll<MiniNode>("knowledge_nodes", "id, kind, canonical_key");

  // group by canonical_key
  const groups = new Map<string, MiniNode[]>();
  for (const n of nodes) {
    if (!n.canonical_key || n.canonical_key.length < 4) continue;
    const g = groups.get(n.canonical_key);
    if (g) g.push(n);
    else groups.set(n.canonical_key, [n]);
  }

  const bridges: EdgeInput[] = [];
  const sharedIds = new Set<string>();

  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const humans = group.filter((n) => n.kind === "human" || n.kind === "shared");
    const others = group.filter((n) => n.kind !== "human");
    if (humans.length === 0 || others.length === 0) continue;

    for (const h of humans) {
      for (const o of others) {
        if (h.id === o.id) continue;
        bridges.push({
          sourceId: h.id,
          targetId: o.id,
          relationship: "same-as",
          source: "derived",
          attrs: { reason: "shared canonical key" },
        });
        sharedIds.add(h.id);
        sharedIds.add(o.id);
      }
    }
  }

  // write the same-as bridges
  await upsertEdges(bridges, syncTs);

  // === Pass 2: slash-compound bridge ===
  // The Haiku extractor sometimes creates concept nodes whose label is two concepts
  // joined with " / " or " & " (e.g. "ai in education / embodied cognition").
  // Bridge each compound node to its component concepts so it inherits their
  // neighbourhood and doesn't strand as an isolated outlier.
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

  const keyIndex = new Map<string, string>(); // canonical_key → node id
  for (const n of nodes) {
    if (n.canonical_key) keyIndex.set(n.canonical_key, n.id);
  }

  const { data: compoundNodes, error: cpErr } = await supabase
    .from("knowledge_nodes")
    .select("id, label")
    .eq("category", "concept")
    .or("label.like.% / %,label.like.% & %");
  if (cpErr) console.warn("[knowledge/reconcile] slash-bridge fetch:", cpErr.message);

  const slashBridges: EdgeInput[] = [];
  for (const n of compoundNodes ?? []) {
    if (!n.label) continue;
    const parts = n.label.split(/ \/ | & /g).map((p: string) => p.trim()).filter(Boolean);
    for (const part of parts) {
      const ck = normalize(part);
      const parentId = keyIndex.get(ck);
      if (parentId && parentId !== n.id) {
        slashBridges.push({
          sourceId: n.id,
          targetId: parentId,
          relationship: "related-to",
          source: "derived",
          attrs: { reason: "slash-compound bridge" },
        });
      }
    }
  }
  if (slashBridges.length > 0) await upsertEdges(slashBridges, syncTs);

  // promote both ends to kind: shared
  const ids = [...sharedIds];
  for (let i = 0; i < ids.length; i += 500) {
    const { error: upErr } = await supabase
      .from("knowledge_nodes")
      .update({ kind: "shared", updated_at: syncTs })
      .in("id", ids.slice(i, i + 500));
    if (upErr) throw new Error(`[knowledge/reconcile] promote: ${upErr.message}`);
  }

  return { bridges: bridges.length, sharedNodes: sharedIds.size };
}
