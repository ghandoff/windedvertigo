/**
 * Agent-side ingestion — the six agents' live Supabase logs → nodes/edges.
 *
 * Two passes:
 *  - structured: domains, curriculum topics, finding domains, and decision tags
 *    map deterministically to `concept:` nodes the agent "researches"/"references".
 *  - freeform: a Haiku pass over finding/decision/incident prose pulls additional
 *    named concepts the agents "observe".
 *
 * Tagged source: agent-log, kind: agent. Concept nodes are deduped by
 * `concept:<canonical_key>` so a concept referenced by several agents is one node.
 * Agent actor nodes use `agent:<slug>` so they merge onto the curated seed.
 */

import { getCarlFindings, getCarlDomains } from "@/lib/supabase/carl";
import { getCurriculum } from "@/lib/supabase/carl-curriculum";
import { getCarlDecisions } from "@/lib/supabase/carl";
import { getPamDecisions } from "@/lib/supabase/pam";
import { getCmoDecisions } from "@/lib/supabase/cmo";
import { getOpsyDecisions, getOpsyIncidents } from "@/lib/supabase/opsy";
import { getRecentBizDecisions } from "@/lib/biz-data";
import { getRecentDecisions as getFinDecisions } from "@/lib/fin-data";
import { extractConcepts, type ExtractInput } from "@/lib/ai/knowledge-extract";
import { canonicalKey } from "./types";
import type { NodeInput, EdgeInput } from "./supabase";

const ACTORS: { slug: string; label: string; description: string }[] = [
  { slug: "carl", label: "cARL", description: "research & learning agent — literature, evidence, curriculum" },
  { slug: "mo", label: "Mo", description: "marketing agent — strategy, brand, pipeline, audience" },
  { slug: "pam", label: "PaM", description: "project & momentum manager — commitments, dependencies" },
  { slug: "opsy", label: "Opsy", description: "operations agent — infrastructure health, incidents" },
  { slug: "biz", label: "Biz", description: "business development agent — RFP, go/no-go, proposal QC" },
  { slug: "fin", label: "Fin", description: "finance agent — QBO, payroll, tax calendar" },
];

export interface AgentIngestResult {
  nodes: NodeInput[];
  edges: EdgeInput[];
  counts: Record<string, number>;
}

export async function ingestAgentLogs(userId = "knowledge-sync"): Promise<AgentIngestResult> {
  const conceptNodes = new Map<string, NodeInput>();
  const edges = new Map<string, EdgeInput>();
  const counts: Record<string, number> = { extracted: 0 };

  const actorNodes: NodeInput[] = ACTORS.map((a) => ({
    id: `agent:${a.slug}`,
    kind: "agent",
    category: "agent",
    label: a.label,
    canonicalKey: canonicalKey(a.slug),
    source: "agent-log",
    sourceRef: `agent:${a.slug}`,
    description: a.description,
    attrs: { agent: a.slug },
  }));

  const addConcept = (label: string, agentSlug: string, relationship: string) => {
    const clean = label.trim();
    if (clean.length < 3) return;
    const key = canonicalKey(clean);
    if (!key) return;
    const id = `concept:${key}`;
    if (!conceptNodes.has(id)) {
      conceptNodes.set(id, {
        id,
        kind: "agent",
        category: "concept",
        label: clean.toLowerCase(),
        canonicalKey: key,
        source: "agent-log",
        attrs: { agent: agentSlug },
      });
    }
    const eKey = `agent:${agentSlug}|${id}|${relationship}`;
    if (!edges.has(eKey)) {
      edges.set(eKey, { sourceId: `agent:${agentSlug}`, targetId: id, relationship, source: "agent-log" });
    }
  };

  // ── structured pass ────────────────────────────────────────
  const [domains, curriculum, findings] = await Promise.all([
    getCarlDomains().catch(() => []),
    getCurriculum({ limit: 200 }).catch(() => []),
    getCarlFindings({ limit: 80 }).catch(() => []),
  ]);

  // domains, curriculum topics and finding domains are higher-signal than raw
  // tags — those become concept nodes; tags are too generic ("infra", "rfp").
  domains.forEach((d) => addConcept(d.label, "carl", "researches"));
  curriculum.forEach((c) => addConcept(c.topic, "carl", "studies"));
  findings.forEach((f) => {
    if (f.domain) addConcept(f.domain, "carl", "researches");
  });
  counts.domains = domains.length;
  counts.curriculum = curriculum.length;
  counts.findings = findings.length;

  // decisions feed the freeform pass only (their summaries name real concepts)
  const [carlD, pamD, cmoD, opsyD] = await Promise.all([
    getCarlDecisions({ limit: 40 }).catch(() => []),
    getPamDecisions({ limit: 40 }).catch(() => []),
    getCmoDecisions({ limit: 40 }).catch(() => []),
    getOpsyDecisions({ limit: 40 }).catch(() => []),
  ]);

  // ── freeform pass (Haiku) ──────────────────────────────────
  const [incidents, bizD, finD] = await Promise.all([
    getOpsyIncidents({ limit: 30 }).catch(() => []),
    getRecentBizDecisions(30).catch(() => []),
    getFinDecisions(30).catch(() => []),
  ]);

  const extractItems: ExtractInput[] = [
    ...findings.slice(0, 50).map((f) => ({
      id: `carl_finding:${f.id}`,
      agent: "carl",
      text: `${f.title}. ${f.summary} ${f.relevance ?? ""}`,
    })),
    ...carlD.slice(0, 25).map((d) => ({ id: `carl_decision:${d.id}`, agent: "carl", text: d.summary })),
    ...pamD.slice(0, 25).map((d) => ({ id: `pam_decision:${d.id}`, agent: "pam", text: d.summary })),
    ...cmoD.slice(0, 25).map((d) => ({ id: `cmo_decision:${d.id}`, agent: "mo", text: d.summary })),
    ...opsyD.slice(0, 20).map((d) => ({ id: `opsy_decision:${d.id}`, agent: "opsy", text: d.summary })),
    ...incidents.map((i) => ({
      id: `opsy_incident:${i.id}`,
      agent: "opsy",
      text: `${i.symptoms} ${i.cause ?? ""}`,
    })),
    ...bizD.map((d) => ({ id: `biz_decision:${d.id}`, agent: "biz", text: `${d.decision} ${d.context ?? ""}` })),
    ...finD.map((d) => ({ id: `fin_decision:${d.id}`, agent: "fin", text: `${d.decision} ${d.context ?? ""}` })),
  ].filter((x) => x.text && x.text.trim().length > 10);

  const extracted = await extractConcepts(extractItems, userId);
  const agentOf = new Map(extractItems.map((x) => [x.id, x.agent]));
  for (const [itemId, concepts] of extracted) {
    const agentSlug = agentOf.get(itemId) ?? "carl";
    concepts.forEach((c) => addConcept(c, agentSlug, "observed"));
    counts.extracted += concepts.length;
  }

  return {
    nodes: [...actorNodes, ...conceptNodes.values()],
    edges: [...edges.values()],
    counts,
  };
}
