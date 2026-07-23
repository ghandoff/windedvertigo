/**
 * Literature layer — cARL's annotated bibliography → graph nodes.
 *
 * Each catalogued source becomes a `literature` node (kind agent, source
 * agent-log), linked to cARL ("catalogued") and to the concept its `topic`
 * names ("grounds"). Because a human framework reconciles to that same concept
 * (a `same-as` bridge), the path framework → concept → literature lets the gap
 * engine answer "does cARL have literature grounding this theory?".
 *
 * `literature` is NOT in PROPOSAL_FACING, so it's hidden until the graph's
 * literature toggle is on — it never worsens the default clutter.
 */

import { getBibliographyRows } from "@/lib/supabase/bibliography";
import { canonicalKey } from "./types";
import type { NodeInput, EdgeInput } from "./supabase";

const MAX_LIT = 150; // cap so the layer stays bounded

export interface BibIngestResult {
  nodes: NodeInput[];
  edges: EdgeInput[];
  counts: Record<string, number>;
}

export async function ingestBibliography(): Promise<BibIngestResult> {
  const rows = await getBibliographyRows().catch(() => []);

  // rank by citations then recency; keep the strongest MAX_LIT
  const ranked = [...rows]
    .sort((a, b) => (b.citationCount ?? 0) - (a.citationCount ?? 0) || (b.year ?? 0) - (a.year ?? 0))
    .slice(0, MAX_LIT);

  const nodes: NodeInput[] = [];
  const edges: EdgeInput[] = [];

  for (const r of ranked) {
    const id = `lit:${r.id}`;
    const label =
      r.title ||
      (r.firstAuthor ? `${r.firstAuthor}${r.year ? ` (${r.year})` : ""}` : null) ||
      (r.fullCitation.length > 60 ? r.fullCitation.slice(0, 58) + "…" : r.fullCitation);
    nodes.push({
      id,
      kind: "agent",
      category: "literature",
      label,
      canonicalKey: canonicalKey(r.title || label),
      source: "agent-log",
      sourceRef: r.doi ? `https://doi.org/${r.doi}` : r.publisherLink || `bibliography:${r.id}`,
      description: r.abstract ?? r.fullCitation,
      attrs: {
        agent: "carl",
        authors: r.authors,
        year: r.year,
        doi: r.doi,
        journal: r.journal,
        topic: r.topic,
        citationCount: r.citationCount,
      },
    });
    // cARL catalogued it
    edges.push({ sourceId: "agent:carl", targetId: id, relationship: "catalogued", source: "agent-log" });
    // grounds the concept its topic names (target may or may not exist — the sync
    // drops the edge if the concept isn't present)
    if (r.topic && r.topic.trim()) {
      const key = canonicalKey(r.topic);
      if (key) edges.push({ sourceId: id, targetId: `concept:${key}`, relationship: "grounds", source: "agent-log" });
    }
  }

  return { nodes, edges, counts: { bibliographyTotal: rows.length, ingested: nodes.length } };
}
