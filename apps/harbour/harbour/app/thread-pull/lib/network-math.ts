import type { HCA, PCRRating, NetworkNode, NetworkEdge, DirectedPair } from "./types";

/* ── palette + shapes ────────────────────────────────────────── */

const NODE_COLOURS = [
  "var(--wv-cornflower)", // #5872cb
  "var(--wv-seafoam)",    // #58cbb2
  "var(--wv-sienna)",     // #cb7858
  "var(--wv-periwinkle)", // #d5d2ff
  "var(--wv-redwood)",    // #b15043
  "var(--wv-teal)",       // #43b187
  "var(--wv-navy)",       // #436db1
  "var(--wv-mint)",       // #d2fdff
  "#e09878",              // warm accent
  "#8b6f5e",              // warm brown
  "#3d5a80",              // steel blue
  "#a78bfa",              // violet
] as const;

const NODE_SHAPES = [
  "circle",
  "square",
  "diamond",
  "triangle",
  "hexagon",
  "star",
] as const;

export function assignColour(index: number): string {
  return NODE_COLOURS[index % NODE_COLOURS.length];
}

export function assignShape(index: number): typeof NODE_SHAPES[number] {
  return NODE_SHAPES[index % NODE_SHAPES.length];
}

/* ── pair generation ─────────────────────────────────────────── */

/** generate all directed pairs, ordered by source frequency (highest first) */
export function generatePairs(hcas: HCA[]): DirectedPair[] {
  const sorted = [...hcas].sort((a, b) => b.frequency - a.frequency);
  const pairs: DirectedPair[] = [];
  for (const source of sorted) {
    for (const target of sorted) {
      if (source.id !== target.id) {
        pairs.push({ sourceId: source.id, targetId: target.id });
      }
    }
  }
  return pairs;
}

/** minimum pairs needed before early exit is allowed */
export function minPairsRequired(hcaCount: number): number {
  return hcaCount - 1; // one full outgoing set for the most frequent HCA
}

/* ── centrality ──────────────────────────────────────────────── */

export function computeEdges(ratings: PCRRating[]): NetworkEdge[] {
  return ratings
    .filter((r) => r.strength > 0)
    .map((r) => ({
      sourceId: r.sourceId,
      targetId: r.targetId,
      strength: r.strength,
    }));
}

export function computeNodes(
  hcas: HCA[],
  edges: NetworkEdge[],
  width: number,
  height: number,
): NetworkNode[] {
  // compute strength scores
  const outMap = new Map<string, number>();
  const inMap = new Map<string, number>();
  for (const hca of hcas) {
    outMap.set(hca.id, 0);
    inMap.set(hca.id, 0);
  }
  for (const edge of edges) {
    outMap.set(edge.sourceId, (outMap.get(edge.sourceId) ?? 0) + edge.strength);
    inMap.set(edge.targetId, (inMap.get(edge.targetId) ?? 0) + edge.strength);
  }

  // normalise centrality (out-strength based)
  const maxOut = Math.max(1, ...Array.from(outMap.values()));

  const nodes: NetworkNode[] = hcas.map((hca) => ({
    hca,
    outStrength: outMap.get(hca.id) ?? 0,
    inStrength: inMap.get(hca.id) ?? 0,
    centrality: (outMap.get(hca.id) ?? 0) / maxOut,
    x: 0,
    y: 0,
  }));

  return forceLayout(nodes, edges, width, height);
}

/* ── force-directed layout ───────────────────────────────────── */

function forceLayout(
  nodes: NetworkNode[],
  edges: NetworkEdge[],
  width: number,
  height: number,
  iterations = 300,
): NetworkNode[] {
  const n = nodes.length;
  if (n === 0) return nodes;

  const cx = width / 2;
  const cy = height / 2;

  // initialise positions in a wide circle to give repulsion a head start
  const result = nodes.map((node, i) => {
    const angle = (2 * Math.PI * i) / n;
    const r = Math.min(width, height) * 0.4;
    return { ...node, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // build index maps
  const idxMap = new Map<string, number>();
  result.forEach((n, i) => idxMap.set(n.hca.id, i));

  // ideal separation — scale with viewport so nodes use the full space
  const idealSep = Math.min(width, height) / Math.max(1.5, n * 0.6);

  const repulsion = 40000;
  const attraction = 0.003;
  const gravity = 0.002;
  const damping = 0.85;
  const minDist = 100; // prevent nodes from ever getting closer than this

  const vx = new Float64Array(n);
  const vy = new Float64Array(n);

  for (let iter = 0; iter < iterations; iter++) {
    const temp = 1 - iter / iterations; // cooling

    // repulsion between all pairs
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        let dx = result[i].x - result[j].x;
        let dy = result[i].y - result[j].y;
        const dist = Math.max(minDist, Math.sqrt(dx * dx + dy * dy));
        // jitter coincident nodes
        if (dx === 0 && dy === 0) {
          dx = (Math.random() - 0.5) * 2;
          dy = (Math.random() - 0.5) * 2;
        }
        const force = (repulsion * temp) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        vx[i] += fx;
        vy[i] += fy;
        vx[j] -= fx;
        vy[j] -= fy;
      }
    }

    // attraction along edges — only pull if beyond ideal separation
    for (const edge of edges) {
      const si = idxMap.get(edge.sourceId);
      const ti = idxMap.get(edge.targetId);
      if (si === undefined || ti === undefined) continue;

      const dx = result[ti].x - result[si].x;
      const dy = result[ti].y - result[si].y;
      const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      // only attract if nodes are farther apart than ideal
      const excess = Math.max(0, dist - idealSep);
      const force = attraction * edge.strength * excess * temp;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      vx[si] += fx;
      vy[si] += fy;
      vx[ti] -= fx;
      vy[ti] -= fy;
    }

    // gentle gravity toward centre — just enough to prevent drift
    for (let i = 0; i < n; i++) {
      vx[i] += (cx - result[i].x) * gravity;
      vy[i] += (cy - result[i].y) * gravity;
    }

    // apply velocities with damping
    const padding = 70; // room for labels below nodes
    for (let i = 0; i < n; i++) {
      vx[i] *= damping;
      vy[i] *= damping;
      result[i].x = Math.max(padding, Math.min(width - padding, result[i].x + vx[i]));
      result[i].y = Math.max(padding, Math.min(height - padding, result[i].y + vy[i]));
    }
  }

  return result;
}

/* ── focus selection ─────────────────────────────────────────── */

/** return the IDs of the top 1-3 most central HCAs */
export function selectFocusNodes(nodes: NetworkNode[]): string[] {
  const sorted = [...nodes].sort((a, b) => b.centrality - a.centrality);
  if (sorted.length === 0) return [];

  // always include the top node
  const focus = [sorted[0].hca.id];

  // include 2nd and 3rd only if they have meaningful centrality (> 50% of top)
  const topCentrality = sorted[0].centrality;
  if (topCentrality > 0) {
    for (let i = 1; i < Math.min(3, sorted.length); i++) {
      if (sorted[i].centrality >= topCentrality * 0.5) {
        focus.push(sorted[i].hca.id);
      }
    }
  }

  return focus;
}

/** get HCA labels connected to a focus node (outgoing edges only) */
export function getConnectedLabels(
  focusId: string,
  edges: NetworkEdge[],
  hcas: HCA[],
): string[] {
  const labelMap = new Map(hcas.map((h) => [h.id, h.label]));
  return edges
    .filter((e) => e.sourceId === focusId)
    .map((e) => labelMap.get(e.targetId) ?? "")
    .filter(Boolean);
}

/* ── SVG path helpers ────────────────────────────────────────── */

/** curved edge path between two nodes */
export function edgePath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  // perpendicular offset for curve
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const offset = Math.min(30, dist * 0.15);
  const nx = -dy / (dist || 1) * offset;
  const ny = dx / (dist || 1) * offset;
  return `M ${x1} ${y1} Q ${mx + nx} ${my + ny} ${x2} ${y2}`;
}

/** node radius based on centrality (for visualisation) */
export function nodeRadius(centrality: number, base = 12, max = 26): number {
  return base + centrality * (max - base);
}
