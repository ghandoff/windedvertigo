"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { GRAPH_DATA, AGENT_META, type GraphNode, type GraphEdge, type AgentId } from "@/lib/knowledge/graph-data";

// ── types ────────────────────────────────────────────────────

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number | null;
  fy?: number | null;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  relationship: string;
}

// ── d3-like force simulation (dependency-free) ───────────────
// instead of importing d3, we run a minimal force-directed layout
// inline. the port has no chart library by design — this keeps
// it dependency-free (custom SVG, like the sparklines).

function forceSimulation(
  nodes: SimNode[],
  edges: SimEdge[],
  width: number,
  height: number,
  iterations = 300,
) {
  const alpha = 0.3;
  const repulsion = -120;
  const linkDistance = 80;
  const linkStrength = 0.15;
  const centerStrength = 0.05;

  // initialise positions in a circle to avoid overlap
  nodes.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / nodes.length;
    const r = Math.min(width, height) * 0.35;
    n.x = width / 2 + r * Math.cos(angle);
    n.y = height / 2 + r * Math.sin(angle);
    n.vx = 0;
    n.vy = 0;
  });

  for (let tick = 0; tick < iterations; tick++) {
    const decay = 1 - (tick / iterations) * 0.9;

    // repulsion (Barnes-Hut would be faster but N≈130 is fine brute-force)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dx = nodes[j].x - nodes[i].x;
        const dy = nodes[j].y - nodes[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (repulsion * decay) / (dist * dist);
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // link attraction
    edges.forEach((e) => {
      const dx = e.target.x - e.source.x;
      const dy = e.target.y - e.source.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const force = (dist - linkDistance) * linkStrength * decay;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      e.source.vx += fx;
      e.source.vy += fy;
      e.target.vx -= fx;
      e.target.vy -= fy;
    });

    // center gravity
    nodes.forEach((n) => {
      n.vx += (width / 2 - n.x) * centerStrength * decay;
      n.vy += (height / 2 - n.y) * centerStrength * decay;
    });

    // integrate + dampen
    const velocityDecay = 0.6;
    nodes.forEach((n) => {
      if (n.fx != null) {
        n.x = n.fx;
        n.vx = 0;
      } else {
        n.vx *= velocityDecay;
        n.x += n.vx;
      }
      if (n.fy != null) {
        n.y = n.fy;
        n.vy = 0;
      } else {
        n.vy *= velocityDecay;
        n.y += n.vy;
      }

      // keep in bounds
      n.x = Math.max(30, Math.min(width - 30, n.x));
      n.y = Math.max(30, Math.min(height - 30, n.y));
    });
  }
}

// ── adjacency helpers ────────────────────────────────────────

function buildAdjacency(edges: GraphEdge[]) {
  const adj = new Map<string, Set<string>>();
  edges.forEach((e) => {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  });
  return adj;
}

// ── component ────────────────────────────────────────────────

export function KnowledgeGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<SimEdge | null>(null);
  const [activeAgents, setActiveAgents] = useState<Set<AgentId>>(
    new Set(Object.keys(AGENT_META) as AgentId[]),
  );
  const [search, setSearch] = useState("");
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  const adj = useMemo(() => buildAdjacency(GRAPH_DATA.edges), []);

  // degree map for sizing
  const degreeMap = useMemo(() => {
    const m = new Map<string, number>();
    GRAPH_DATA.nodes.forEach((n) => m.set(n.id, 0));
    GRAPH_DATA.edges.forEach((e) => {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    });
    return m;
  }, []);

  // filter nodes by active agents + search
  const filteredNodes = useMemo(() => {
    let nodes = GRAPH_DATA.nodes.filter((n) => activeAgents.has(n.agent));
    if (search.trim()) {
      const q = search.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.label.toLowerCase().includes(q) ||
          n.description.toLowerCase().includes(q) ||
          n.category.toLowerCase().includes(q),
      );
    }
    return nodes;
  }, [activeAgents, search]);

  const filteredNodeIds = useMemo(
    () => new Set(filteredNodes.map((n) => n.id)),
    [filteredNodes],
  );

  const filteredEdges = useMemo(
    () =>
      GRAPH_DATA.edges.filter(
        (e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target),
      ),
    [filteredNodeIds],
  );

  // run layout
  const { simNodes, simEdges } = useMemo(() => {
    const w = 900;
    const h = 700;
    const nodeMap = new Map<string, SimNode>();
    const sn: SimNode[] = filteredNodes.map((n) => {
      const node: SimNode = { ...n, x: 0, y: 0, vx: 0, vy: 0 };
      nodeMap.set(n.id, node);
      return node;
    });
    const se: SimEdge[] = filteredEdges
      .filter((e) => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map((e) => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        relationship: e.relationship,
      }));
    forceSimulation(sn, se, w, h);
    return { simNodes: sn, simEdges: se };
  }, [filteredNodes, filteredEdges]);

  // neighbours of selected node
  const neighbours = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const s = new Set<string>();
    s.add(selectedNode);
    adj.get(selectedNode)?.forEach((id) => {
      if (filteredNodeIds.has(id)) s.add(id);
    });
    return s;
  }, [selectedNode, adj, filteredNodeIds]);

  // node radius based on degree
  const nodeRadius = useCallback(
    (id: string, category: string) => {
      if (category === "agent") return 10;
      const d = degreeMap.get(id) ?? 0;
      return Math.max(4, Math.min(12, 3 + d * 1.2));
    },
    [degreeMap],
  );

  // zoom/pan via wheel
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        // zoom
        const factor = e.deltaY > 0 ? 0.9 : 1.1;
        setTransform((t) => ({
          ...t,
          k: Math.max(0.3, Math.min(3, t.k * factor)),
        }));
      } else {
        // pan
        setTransform((t) => ({
          ...t,
          x: t.x - e.deltaX,
          y: t.y - e.deltaY,
        }));
      }
    },
    [],
  );

  // edges for selected node's detail panel
  const selectedEdges = useMemo(() => {
    if (!selectedNode) return { outgoing: [] as GraphEdge[], incoming: [] as GraphEdge[] };
    return {
      outgoing: GRAPH_DATA.edges.filter((e) => e.source === selectedNode),
      incoming: GRAPH_DATA.edges.filter((e) => e.target === selectedNode),
    };
  }, [selectedNode]);

  const selectedNodeData = useMemo(
    () => GRAPH_DATA.nodes.find((n) => n.id === selectedNode),
    [selectedNode],
  );

  const nodeMap = useMemo(
    () => new Map(GRAPH_DATA.nodes.map((n) => [n.id, n])),
    [],
  );

  return (
    <div className="space-y-4">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        {(Object.entries(AGENT_META) as [AgentId, (typeof AGENT_META)[AgentId]][]).map(
          ([id, meta]) => (
            <button
              key={id}
              onClick={() =>
                setActiveAgents((prev) => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id);
                  else next.add(id);
                  return next;
                })
              }
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
              style={{
                borderColor: activeAgents.has(id) ? meta.color : "var(--border)",
                backgroundColor: activeAgents.has(id) ? `${meta.color}15` : "transparent",
                color: activeAgents.has(id) ? meta.color : "var(--muted-foreground)",
              }}
            >
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: meta.color, opacity: activeAgents.has(id) ? 1 : 0.3 }}
              />
              {meta.label}
            </button>
          ),
        )}
        <input
          type="text"
          placeholder="search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded-md border border-border bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* graph + detail panel */}
      <div className="flex gap-4">
        {/* svg graph */}
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden rounded-lg border border-border bg-card"
          style={{ minHeight: 500 }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 900 700"
            className="h-full w-full"
            onWheel={handleWheel}
            onClick={(e) => {
              if (e.target === svgRef.current || (e.target as Element).tagName === "svg") {
                setSelectedNode(null);
              }
            }}
          >
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {/* edges */}
              {simEdges.map((e, i) => {
                const dim =
                  selectedNode && !neighbours.has(e.source.id) && !neighbours.has(e.target.id);
                return (
                  <line
                    key={i}
                    x1={e.source.x}
                    y1={e.source.y}
                    x2={e.target.x}
                    y2={e.target.y}
                    stroke={
                      dim ? "var(--border)" : "var(--muted-foreground)"
                    }
                    strokeOpacity={dim ? 0.15 : 0.25}
                    strokeWidth={1}
                    onMouseEnter={() => setHoveredEdge(e)}
                    onMouseLeave={() => setHoveredEdge(null)}
                    style={{ cursor: "default" }}
                  />
                );
              })}

              {/* edge label on hover */}
              {hoveredEdge && (
                <text
                  x={(hoveredEdge.source.x + hoveredEdge.target.x) / 2}
                  y={(hoveredEdge.source.y + hoveredEdge.target.y) / 2 - 6}
                  textAnchor="middle"
                  fill="var(--foreground)"
                  fontSize={9}
                  fontFamily="var(--font-mono, monospace)"
                  pointerEvents="none"
                >
                  {hoveredEdge.relationship}
                </text>
              )}

              {/* nodes */}
              {simNodes.map((n) => {
                const r = nodeRadius(n.id, n.category);
                const color = AGENT_META[n.agent]?.color ?? "#6b7280";
                const dim = selectedNode && !neighbours.has(n.id);
                const isSelected = n.id === selectedNode;
                return (
                  <g key={n.id} style={{ cursor: "pointer" }} onClick={() => setSelectedNode(n.id)}>
                    {isSelected && (
                      <circle
                        cx={n.x}
                        cy={n.y}
                        r={r + 4}
                        fill="none"
                        stroke={color}
                        strokeWidth={2}
                        strokeOpacity={0.5}
                      />
                    )}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r}
                      fill={color}
                      fillOpacity={dim ? 0.15 : n.category === "agent" ? 1 : 0.75}
                      stroke={isSelected ? color : "none"}
                      strokeWidth={isSelected ? 2 : 0}
                    />
                    {(r >= 6 || isSelected) && (
                      <text
                        x={n.x}
                        y={n.y + r + 11}
                        textAnchor="middle"
                        fill="var(--foreground)"
                        fontSize={9}
                        opacity={dim ? 0.25 : 0.8}
                        pointerEvents="none"
                      >
                        {n.label.length > 18 ? n.label.slice(0, 16) + "..." : n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* stats bar */}
          <div className="absolute bottom-2 left-2 flex gap-3 rounded bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            <span>{filteredNodes.length} nodes</span>
            <span>{filteredEdges.length} edges</span>
            <span>{(transform.k * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* detail panel */}
        {selectedNodeData && (
          <div className="w-72 shrink-0 space-y-3 rounded-lg border border-border bg-card p-4">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{
                    backgroundColor: AGENT_META[selectedNodeData.agent]?.color ?? "#6b7280",
                  }}
                />
                <h3 className="text-sm font-semibold">{selectedNodeData.label}</h3>
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {selectedNodeData.category} · {selectedNodeData.agent}
              </p>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {selectedNodeData.description}
            </p>

            {selectedEdges.outgoing.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  outgoing
                </p>
                <ul className="space-y-0.5">
                  {selectedEdges.outgoing.map((e, i) => (
                    <li key={i} className="text-xs">
                      <button
                        className="text-left hover:underline"
                        onClick={() => setSelectedNode(e.target)}
                      >
                        <span className="text-muted-foreground">{e.relationship} →</span>{" "}
                        {nodeMap.get(e.target)?.label ?? e.target}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {selectedEdges.incoming.length > 0 && (
              <div>
                <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  incoming
                </p>
                <ul className="space-y-0.5">
                  {selectedEdges.incoming.map((e, i) => (
                    <li key={i} className="text-xs">
                      <button
                        className="text-left hover:underline"
                        onClick={() => setSelectedNode(e.source)}
                      >
                        {nodeMap.get(e.source)?.label ?? e.source}{" "}
                        <span className="text-muted-foreground">→ {e.relationship}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={() => setSelectedNode(null)}
              className="w-full rounded border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted"
            >
              close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
