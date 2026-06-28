/**
 * Knowledge-sync orchestrator.
 *
 * Runs all three sources → upserts nodes then edges (idempotent) → reconciles
 * the human↔agent merge bridges → prunes dangling edges. Each source is wrapped
 * so one failing (e.g. Notion not yet shared with the integration) doesn't abort
 * the others — the graph still populates with whatever is reachable.
 *
 * Returns a report the cron logs and returns as JSON.
 */

import { curatedGraphInputs } from "./ingest-curated";
import { ingestNotionCv } from "./ingest-notion";
import { ingestAgentLogs } from "./ingest-agents";
import { reconcile } from "./reconcile";
import { reconcileFuzzy, type FuzzyResult } from "./reconcile-fuzzy";
import {
  upsertNodes,
  upsertEdges,
  pruneDanglingEdges,
  pruneStaleNodes,
  type NodeInput,
  type EdgeInput,
} from "./supabase";

export interface SyncReport {
  ok: boolean;
  syncTs: string;
  sources: Record<string, unknown>;
  nodes: { added: number; updated: number; total: number };
  edges: { upserted: number; dropped: number; pruned: number };
  reconcile: { bridges: number; sharedNodes: number };
  fuzzy: FuzzyResult;
  errors: string[];
}

const edgeKey = (e: EdgeInput) => `${e.sourceId}|${e.targetId}|${e.relationship}|${e.source}`;

export async function runKnowledgeSync(userId = "knowledge-sync"): Promise<SyncReport> {
  const syncTs = new Date().toISOString();
  const errors: string[] = [];
  const sources: Record<string, unknown> = {};

  // ── gather from all sources (resilient) ────────────────────
  const curated = curatedGraphInputs();
  sources.curated = { nodes: curated.nodes.length, edges: curated.edges.length };

  let notionNodes: NodeInput[] = [];
  let notionEdges: EdgeInput[] = [];
  try {
    const n = await ingestNotionCv();
    notionNodes = n.nodes;
    notionEdges = n.edges;
    sources.notion = n.counts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`notion: ${msg}`);
    sources.notion = { skipped: true, reason: msg.slice(0, 160) };
  }

  let agentNodes: NodeInput[] = [];
  let agentEdges: EdgeInput[] = [];
  try {
    const a = await ingestAgentLogs(userId);
    agentNodes = a.nodes;
    agentEdges = a.edges;
    sources.agents = a.counts;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`agents: ${msg}`);
    sources.agents = { skipped: true, reason: msg.slice(0, 160) };
  }

  // ── upsert nodes (per source; later sources win id conflicts) ──
  let added = 0;
  let updated = 0;
  for (const batch of [curated.nodes, notionNodes, agentNodes]) {
    if (batch.length === 0) continue;
    const r = await upsertNodes(batch, syncTs);
    added += r.added;
    updated += r.updated;
  }
  const totalNodes = curated.nodes.length + notionNodes.length + agentNodes.length;

  // ── upsert edges (dedupe by tuple; drop dangling endpoints) ──
  const validIds = new Set(
    [...curated.nodes, ...notionNodes, ...agentNodes].map((n) => n.id),
  );
  const seen = new Set<string>();
  const allEdges: EdgeInput[] = [];
  let dropped = 0;
  for (const e of [...curated.edges, ...notionEdges, ...agentEdges]) {
    if (!validIds.has(e.sourceId) || !validIds.has(e.targetId)) {
      dropped++;
      continue;
    }
    const k = edgeKey(e);
    if (seen.has(k)) continue;
    seen.add(k);
    allEdges.push(e);
  }
  await upsertEdges(allEdges, syncTs);

  // ── merge bridges (exact then fuzzy) + cleanup ─────────────
  const recon = await reconcile(syncTs);
  const fuzzy = await reconcileFuzzy(syncTs, userId);
  const staleNodes = await pruneStaleNodes(syncTs);
  const pruned = (await pruneDanglingEdges()) + staleNodes;

  return {
    ok: errors.length === 0,
    syncTs,
    sources,
    nodes: { added, updated, total: totalNodes },
    edges: { upserted: allEdges.length, dropped, pruned },
    reconcile: recon,
    fuzzy,
    errors,
  };
}
