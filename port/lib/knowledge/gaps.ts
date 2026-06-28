/**
 * Gap analysis over the unified knowledge graph.
 *
 * Two families of detector:
 *  - concept-scaffold (1-5): the original /brain detectors over the curated
 *    agent graph. Unchanged logic.
 *  - cross-graph (6-11): compare what humans CLAIM (notion-cv) against what
 *    agents have OBSERVED (agent-log). These stay silent until live data flows
 *    (they require human/agent nodes that the curated-only const doesn't have).
 */

import {
  type GraphData,
  type GraphEdge,
  type Gap,
  type NodeCategory,
  canonicalKey,
  STALE_MONTHS,
} from "./types";

interface Adj {
  /** undirected neighbour id set per node */
  neighbours: Map<string, Set<string>>;
  /** every edge touching a node */
  edgesByNode: Map<string, GraphEdge[]>;
}

function buildAdj(data: GraphData): Adj {
  const neighbours = new Map<string, Set<string>>();
  const edgesByNode = new Map<string, GraphEdge[]>();
  data.nodes.forEach((n) => {
    neighbours.set(n.id, new Set());
    edgesByNode.set(n.id, []);
  });
  data.edges.forEach((e) => {
    neighbours.get(e.source)?.add(e.target);
    neighbours.get(e.target)?.add(e.source);
    edgesByNode.get(e.source)?.push(e);
    edgesByNode.get(e.target)?.push(e);
  });
  return { neighbours, edgesByNode };
}

/** other endpoint of an edge relative to `id` */
function other(e: GraphEdge, id: string): string {
  return e.source === id ? e.target : e.source;
}

/** months between an ISO/year-ish date string and now; Infinity if unparseable */
function monthsAgo(value: string | undefined): number {
  if (!value) return Infinity;
  const t = Date.parse(value.length === 4 ? `${value}-06-30` : value);
  if (Number.isNaN(t)) return Infinity;
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44);
}

export function computeGaps(data: GraphData): Gap[] {
  const gaps: Gap[] = [];
  const { neighbours, edgesByNode } = buildAdj(data);
  const nodeMap = new Map(data.nodes.map((n) => [n.id, n]));
  const byCategory = (c: NodeCategory) => data.nodes.filter((n) => n.category === c);

  // ─────────────────────────────────────────────────────────────
  // 1-5. concept-scaffold detectors (original behaviour)
  // ─────────────────────────────────────────────────────────────

  // 1. isolated nodes (0 connections, excluding agents themselves)
  data.nodes.forEach((n) => {
    if (n.category === "agent") return;
    if ((neighbours.get(n.id)?.size ?? 0) === 0) {
      gaps.push({
        type: "isolated",
        severity: "medium",
        title: `${n.label} is isolated`,
        description: `mentioned in brain files but has no mapped relationships. either the connection is implicit, or this node needs linking.`,
        nodeIds: [n.id],
        curriculumSuggestion:
          n.category === "concept"
            ? `research how "${n.label}" connects to the collective's practice`
            : undefined,
      });
    }
  });

  // 2. shallow research domains (research-domain with ≤1 concept connections)
  byCategory("research-domain").forEach((domain) => {
    const conceptEdges = (edgesByNode.get(domain.id) ?? []).filter(
      (e) => nodeMap.get(other(e, domain.id))?.category === "concept",
    );
    if (conceptEdges.length <= 1) {
      gaps.push({
        type: "shallow-research",
        severity: "high",
        title: `"${domain.label}" has thin conceptual grounding`,
        description: `this research domain connects to only ${conceptEdges.length} concept node(s). cARL should deepen the theoretical foundation.`,
        nodeIds: [domain.id],
        curriculumSuggestion: `study foundational theories and frameworks within "${domain.label}" — identify 3-5 key concepts, authors, and effect sizes`,
      });
    }
  });

  // 3. ungrounded products (products with no research-domain or concept edges)
  byCategory("product").forEach((product) => {
    const researchEdges = (edgesByNode.get(product.id) ?? []).filter((e) => {
      const cat = nodeMap.get(other(e, product.id))?.category;
      return cat === "research-domain" || cat === "concept";
    });
    if (researchEdges.length === 0) {
      gaps.push({
        type: "ungrounded-product",
        severity: "medium",
        title: `"${product.label}" has no research backing`,
        description: `this product isn't connected to any research domain or concept. it may work well in practice, but the evidence link is unmapped.`,
        nodeIds: [product.id],
        curriculumSuggestion: `identify the pedagogical theory that grounds "${product.label}" and map the evidence base`,
      });
    }
  });

  // 4. client projects without methodology nodes
  byCategory("project").forEach((project) => {
    const methodEdges = (edgesByNode.get(project.id) ?? []).filter((e) => {
      const o = nodeMap.get(other(e, project.id));
      return (
        o?.category === "concept" &&
        (o.description.includes("method") ||
          o.description.includes("framework") ||
          o.description.includes("evaluation") ||
          o.description.includes("synthesis"))
      );
    });
    const isClientWork = (edgesByNode.get(project.id) ?? []).some(
      (e) => nodeMap.get(other(e, project.id))?.category === "client",
    );
    if (methodEdges.length === 0 && isClientWork) {
      gaps.push({
        type: "no-methodology",
        severity: "low",
        title: `"${project.label}" lacks explicit methodology`,
        description: `this client project doesn't connect to any methodological concept. adding a framework strengthens proposals and deliverables.`,
        nodeIds: [project.id],
        curriculumSuggestion: `research appropriate evaluation/synthesis methodologies for "${project.label}"`,
      });
    }
  });

  // 5. thin inter-agent bridges
  const agentIds = byCategory("agent").map((n) => n.id);
  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      const a = agentIds[i];
      const b = agentIds[j];
      const direct = data.edges.some(
        (e) => (e.source === a && e.target === b) || (e.source === b && e.target === a),
      );
      if (!direct) {
        const aNode = nodeMap.get(a);
        const bNode = nodeMap.get(b);
        if (aNode && bNode) {
          gaps.push({
            type: "thin-bridge",
            severity: "low",
            title: `${aNode.label} ↔ ${bNode.label} have no direct link`,
            description: `these agents don't have a direct relationship edge. they may coordinate through shared nodes, but an explicit protocol is unmapped.`,
            nodeIds: [a, b],
          });
        }
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 6-11. cross-graph detectors (human claims ↔ agent observations)
  // ─────────────────────────────────────────────────────────────

  const skills = byCategory("skill");
  const concepts = byCategory("concept");
  const members = byCategory("member");
  const frameworks = byCategory("framework");
  const populations = byCategory("population");
  const services = byCategory("service");
  const cvEntries = byCategory("cv-entry");

  // index human-held capability keys (skills + frameworks + methods)
  const humanKeys = new Set<string>(
    [...skills, ...frameworks, ...byCategory("method")].map(
      (n) => n.canonicalKey ?? canonicalKey(n.label),
    ),
  );

  // 6. capability gaps — agents observe a concept no human lists as a skill
  if (skills.length > 0) {
    const seen = new Set<string>();
    concepts
      .filter((n) => n.source === "agent-log" || n.kind === "agent")
      .forEach((concept) => {
        const key = concept.canonicalKey ?? canonicalKey(concept.label);
        if (humanKeys.has(key) || seen.has(key)) return;
        seen.add(key);
        gaps.push({
          type: "capability-gap",
          severity: "high",
          title: `agents work on "${concept.label}" but no human claims it`,
          description: `the agents reference "${concept.label}" in their logs, but it isn't a Skill on anyone's CV. candidate for a new Skills entry.`,
          nodeIds: [concept.id],
          curriculumSuggestion: `decide whether "${concept.label}" should become a named Skill the collective markets`,
        });
      });
  }

  // helper: cv-entries demonstrating a given capability node
  const entriesFor = (capId: string) =>
    (edgesByNode.get(capId) ?? [])
      .map((e) => nodeMap.get(other(e, capId)))
      .filter((n) => n?.category === "cv-entry");

  // 7. claimed-but-unevidenced — human skill with no recent demonstrating entry
  skills
    .filter((s) => s.kind === "human" || s.kind === "shared")
    .forEach((skill) => {
      const entries = entriesFor(skill.id);
      // an entry counts as recent if its end-date attr is within the window
      const recentByDate = entries.some((e) => {
        const end = (e as { attrs?: { endDate?: string; year?: string } })?.attrs;
        return monthsAgo(end?.endDate ?? end?.year) < STALE_MONTHS;
      });
      if (entries.length === 0 || !recentByDate) {
        gaps.push({
          type: "claimed-unevidenced",
          severity: entries.length === 0 ? "high" : "medium",
          title: `"${skill.label}" is claimed but ${entries.length === 0 ? "unevidenced" : "stale"}`,
          description:
            entries.length === 0
              ? `this skill is on a CV but no canonical CV entry demonstrates it. likely aspirational, or the evidence needs linking.`
              : `the demonstrating CV entries for this skill are all older than ${STALE_MONTHS} months. consider refreshing with recent work.`,
          nodeIds: [skill.id],
        });
      }
    });

  // 8. evidence asymmetries — member holds a skill, but no entry shows them doing it
  members.forEach((member) => {
    const memberEntries = new Set(
      (edgesByNode.get(member.id) ?? [])
        .map((e) => other(e, member.id))
        .filter((id) => nodeMap.get(id)?.category === "cv-entry"),
    );
    const heldSkills = (edgesByNode.get(member.id) ?? [])
      .map((e) => nodeMap.get(other(e, member.id)))
      .filter((n) => n?.category === "skill");
    heldSkills.forEach((skill) => {
      if (!skill) return;
      const demonstrated = (edgesByNode.get(skill.id) ?? []).some((e) => {
        const o = other(e, skill.id);
        return nodeMap.get(o)?.category === "cv-entry" && memberEntries.has(o);
      });
      if (!demonstrated) {
        gaps.push({
          type: "evidence-asymmetry",
          severity: "low",
          title: `${member.label} claims "${skill.label}" without a matching entry`,
          description: `${member.label} is linked to "${skill.label}", but none of their CV entries demonstrate that pairing. candidate for a proficiency-narrative sub-page or a new entry.`,
          nodeIds: [member.id, skill.id],
        });
      }
    });
  });

  // 9. framework adoption gaps — a framework no agent has invoked
  if (frameworks.length > 0) {
    const agentRefKeys = new Set(
      concepts
        .filter((n) => n.source === "agent-log" || n.kind === "agent")
        .map((n) => n.canonicalKey ?? canonicalKey(n.label)),
    );
    frameworks.forEach((fw) => {
      const key = fw.canonicalKey ?? canonicalKey(fw.label);
      const adoptedByAgent = fw.kind === "shared" || agentRefKeys.has(key);
      if (!adoptedByAgent) {
        gaps.push({
          type: "framework-adoption",
          severity: "low",
          title: `"${fw.label}" is unused by the agents`,
          description: `this framework is a named intellectual asset, but no agent has referenced it in their work. it may be dormant, or the agents should be taught to apply it.`,
          nodeIds: [fw.id],
          curriculumSuggestion: `brief the agents on when to apply "${fw.label}"`,
        });
      }
    });
  }

  // 10. population coverage gaps — a population served by no CV entry
  populations.forEach((pop) => {
    const served = (edgesByNode.get(pop.id) ?? []).some(
      (e) => nodeMap.get(other(e, pop.id))?.category === "cv-entry",
    );
    if (!served) {
      gaps.push({
        type: "population-coverage",
        severity: "low",
        title: `"${pop.label}" has no demonstrating work`,
        description: `this population is in the audience taxonomy, but no CV entry is tagged as serving it. evidence of work with this group is unmapped.`,
        nodeIds: [pop.id],
      });
    }
  });

  // 11. service coverage gaps — a service with thin exemplar evidence
  services.forEach((svc) => {
    const strong = entriesFor(svc.id).filter((e) => {
      const attrs = (e as { attrs?: { endDate?: string; year?: string; status?: string } })?.attrs;
      const recent = monthsAgo(attrs?.endDate ?? attrs?.year) < 5 * 12;
      return recent || !attrs?.endDate;
    });
    if (strong.length < 3) {
      gaps.push({
        type: "service-coverage",
        severity: "medium",
        title: `"${svc.label}" has thin exemplar evidence`,
        description: `this service offering links to only ${strong.length} strong exemplar project(s) in the last 5 years. proposals leading with it would be under-evidenced.`,
        nodeIds: [svc.id],
        curriculumSuggestion: `surface or create 3+ recent exemplar projects for "${svc.label}"`,
      });
    }
  });

  // sort by severity
  const order = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => order[a.severity] - order[b.severity]);
  return gaps;
}
