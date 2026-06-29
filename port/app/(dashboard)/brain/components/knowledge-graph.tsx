"use client";

import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import {
  AGENT_META,
  PROVENANCE_META,
  getNodeColor,
  PROPOSAL_FACING,
  type GraphData,
  type GraphNode,
  type GraphEdge,
  type NodeKind,
  type AgentId,
} from "@/lib/knowledge/types";

// ── types ────────────────────────────────────────────────────

interface SimNode extends GraphNode {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface SimEdge {
  source: SimNode;
  target: SimNode;
  relationship: string;
}

const KINDS: NodeKind[] = ["human", "agent", "shared"];
const AGENTS: AgentId[] = ["mo", "carl", "pam", "opsy", "biz", "fin"];
const nodeKind = (n: GraphNode): NodeKind => n.kind ?? "agent";
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

// ── force simulation (dependency-free) ───────────────────────

function forceSimulation(nodes: SimNode[], edges: SimEdge[], width: number, height: number) {
  const iterations = nodes.length > 150 ? 150 : 300; // adaptive: O(n²) per tick
  const repulsion = -120;
  const linkDistance = 80;
  const linkStrength = 0.15;
  const centerStrength = 0.05;

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
    nodes.forEach((n) => {
      n.vx += (width / 2 - n.x) * centerStrength * decay;
      n.vy += (height / 2 - n.y) * centerStrength * decay;
      n.vx *= 0.6;
      n.vy *= 0.6;
      n.x = clamp(n.x + n.vx, 30, width - 30);
      n.y = clamp(n.y + n.vy, 30, height - 30);
    });
  }
}

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

// ── small popover checklist ──────────────────────────────────

function FilterDropdown({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string;
  options: { id: string; label: string; color?: string }[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const active = selected.size > 0;
  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
        style={{
          borderColor: active ? "var(--foreground)" : "var(--border)",
          color: active ? "var(--foreground)" : "var(--muted-foreground)",
          backgroundColor: active ? "var(--muted)" : "transparent",
        }}
      >
        {label}
        {active ? ` (${selected.size})` : ""} <span className="text-[9px]">▾</span>
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 max-h-72 w-56 overflow-auto rounded-lg border border-border bg-card p-1 shadow-lg">
          {active && (
            <button
              onClick={onClear}
              className="mb-1 w-full rounded px-2 py-1 text-left text-[11px] text-muted-foreground hover:bg-muted"
            >
              clear all
            </button>
          )}
          {options.map((o) => (
            <label
              key={o.id}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-muted"
            >
              <input type="checkbox" checked={selected.has(o.id)} onChange={() => onToggle(o.id)} className="h-3 w-3" />
              {o.color && <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: o.color }} />}
              <span className="truncate">{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ── legend (shown in the drawer empty state) ─────────────────

function Legend() {
  return (
    <div className="space-y-3 text-xs">
      <div>
        <p className="mb-1 font-medium text-foreground">provenance</p>
        {(
          [
            ["human (CV)", PROVENANCE_META.human.color],
            ["shared (merged)", PROVENANCE_META.shared.color],
          ] as const
        ).map(([l, c]) => (
          <div key={l} className="flex items-center gap-2 text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c }} />
            {l}
          </div>
        ))}
      </div>
      <div>
        <p className="mb-1 font-medium text-foreground">agents (by owner)</p>
        <div className="grid grid-cols-2 gap-y-0.5">
          {AGENTS.map((a) => (
            <div key={a} className="flex items-center gap-2 text-muted-foreground">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AGENT_META[a].color }} />
              {AGENT_META[a].label}
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1 font-medium text-foreground">markers</p>
        <p className="text-muted-foreground">
          <span style={{ color: PROVENANCE_META.shared.color }}>– – –</span> gold dashed link = human↔agent merge
        </p>
        <p className="text-muted-foreground">⊙ dashed ring = stale / under-evidenced</p>
      </div>
      <p className="border-t border-border pt-2 text-[11px] text-muted-foreground">
        hover a node to peek · click to inspect · drag to pan · scroll to zoom
      </p>
    </div>
  );
}

// ── component ────────────────────────────────────────────────

export function KnowledgeGraph({
  data,
  staleNodeIds,
  initialFocus,
}: {
  data: GraphData;
  staleNodeIds?: Set<string>;
  initialFocus?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const pinchRef = useRef<{ dist: number; midX: number; midY: number } | null>(null);
  const stale = staleNodeIds ?? new Set<string>();

  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(initialFocus ?? null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [activeKinds, setActiveKinds] = useState<Set<NodeKind>>(new Set(KINDS));
  const [activeAgents, setActiveAgents] = useState<Set<string>>(new Set());
  const [activePersons, setActivePersons] = useState<Set<string>>(new Set());
  const [proposalOnly, setProposalOnly] = useState(true);
  const [showLit, setShowLit] = useState(false);
  const [labelMode, setLabelMode] = useState<"hubs" | "all" | "none">("hubs");
  const [search, setSearch] = useState("");
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });
  const [drawerOpen, setDrawerOpen] = useState(true);

  // focus a node passed from the gap tab (deep-link)
  useEffect(() => {
    if (initialFocus) {
      setFocusId(initialFocus);
      setSelectedNode(initialFocus);
    }
  }, [initialFocus]);

  const adj = useMemo(() => buildAdjacency(data.edges), [data.edges]);
  const nodeMap = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data.nodes]);

  const degreeMap = useMemo(() => {
    const m = new Map<string, number>();
    data.nodes.forEach((n) => m.set(n.id, 0));
    data.edges.forEach((e) => {
      m.set(e.source, (m.get(e.source) ?? 0) + 1);
      m.set(e.target, (m.get(e.target) ?? 0) + 1);
    });
    return m;
  }, [data]);

  // hubs = agents + members + top-degree nodes (always labelled in "hubs" mode)
  const hubIds = useMemo(() => {
    const s = new Set<string>();
    data.nodes.forEach((n) => {
      if (n.category === "agent" || n.category === "member") s.add(n.id);
    });
    const sorted = [...degreeMap.entries()].sort((a, b) => b[1] - a[1]);
    let added = 0;
    for (const [id] of sorted) {
      if (!s.has(id)) {
        s.add(id);
        if (++added >= 14) break;
      }
    }
    return s;
  }, [data.nodes, degreeMap]);

  const members = useMemo(
    () =>
      data.nodes
        .filter((n) => n.category === "member")
        .sort((a, b) => a.label.localeCompare(b.label))
        .map((n) => ({ id: n.id, label: n.label, color: getNodeColor(n) })),
    [data.nodes],
  );

  // person filter → union of selected members + their neighbours
  const personSet = useMemo(() => {
    if (activePersons.size === 0) return null;
    const s = new Set<string>();
    activePersons.forEach((id) => {
      s.add(id);
      adj.get(id)?.forEach((nb) => s.add(nb));
    });
    return s;
  }, [activePersons, adj]);

  const focusSet = useMemo(() => {
    if (!focusId) return null;
    const s = new Set<string>([focusId]);
    adj.get(focusId)?.forEach((id) => s.add(id));
    return s;
  }, [focusId, adj]);

  const filteredNodes = useMemo(() => {
    let nodes = data.nodes.filter((n) => activeKinds.has(nodeKind(n)));
    // proposal-facing is the default lens, but a pinned focus (e.g. from a gap)
    // shows its full neighbourhood regardless of category.
    if (proposalOnly && !focusSet)
      nodes = nodes.filter(
        (n) => PROPOSAL_FACING.has(n.category) || (showLit && (n.category === "literature" || n.category === "concept")),
      );
    if (focusSet) nodes = nodes.filter((n) => focusSet.has(n.id));
    // agent + person lenses (union when both active)
    if (activeAgents.size > 0 || personSet) {
      nodes = nodes.filter((n) => {
        const byAgent = activeAgents.size > 0 && activeAgents.has(n.agent);
        const byPerson = personSet?.has(n.id) ?? false;
        return byAgent || byPerson;
      });
    }
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
  }, [data.nodes, activeKinds, proposalOnly, showLit, focusSet, activeAgents, personSet, search]);

  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map((n) => n.id)), [filteredNodes]);

  const filteredEdges = useMemo(
    () => data.edges.filter((e) => filteredNodeIds.has(e.source) && filteredNodeIds.has(e.target)),
    [data.edges, filteredNodeIds],
  );

  const { simNodes, simEdges } = useMemo(() => {
    const w = 900;
    const h = 700;
    const map = new Map<string, SimNode>();
    const sn: SimNode[] = filteredNodes.map((n) => {
      const node: SimNode = { ...n, x: 0, y: 0, vx: 0, vy: 0 };
      map.set(n.id, node);
      return node;
    });
    const se: SimEdge[] = filteredEdges
      .filter((e) => map.has(e.source) && map.has(e.target))
      .map((e) => ({ source: map.get(e.source)!, target: map.get(e.target)!, relationship: e.relationship }));
    forceSimulation(sn, se, w, h);
    return { simNodes: sn, simEdges: se };
  }, [filteredNodes, filteredEdges]);

  const neighbours = useMemo(() => {
    if (!selectedNode) return new Set<string>();
    const s = new Set<string>([selectedNode]);
    adj.get(selectedNode)?.forEach((id) => {
      if (filteredNodeIds.has(id)) s.add(id);
    });
    return s;
  }, [selectedNode, adj, filteredNodeIds]);

  const nodeRadius = useCallback(
    (id: string, category: string) => {
      if (category === "agent") return 6;
      const d = degreeMap.get(id) ?? 0;
      return Math.max(2, Math.min(6, 2 + d * 0.5));
    },
    [degreeMap],
  );

  // Greedy label collision avoidance — suppress labels whose estimated bboxes overlap.
  // Processes nodes in priority order so important labels always win space. Runs after
  // every sim change, zoom change, or hover change (all fast at our node counts ≤1k).
  const suppressedLabels = useMemo(() => {
    const k = transform.k;
    const suppressed = new Set<string>();
    const committed: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    const charW = 5.2; // SVG units per char at fontSize 9
    const lineH = 14;

    // Local copy of label gate (can't call the outer labelFor from inside useMemo cleanly)
    const wouldShow = (n: SimNode, isCtx: boolean): boolean => {
      if (isCtx || n.id === hoveredNode) return true;
      if (labelMode === "none") return false;
      if (labelMode === "all") return k >= 0.55;
      return hubIds.has(n.id) && k >= 0.28;
    };

    // Sort by decreasing priority so higher-priority labels get space first
    const sorted = [...simNodes].sort((a, b) => {
      const pri = (n: SimNode) =>
        n.id === hoveredNode || n.id === selectedNode ? 4
          : selectedNode && neighbours.has(n.id) ? 3
          : hubIds.has(n.id) ? 2
          : (degreeMap.get(n.id) ?? 0) > 4 ? 1
          : 0;
      return pri(b) - pri(a);
    });

    for (const n of sorted) {
      const isCtx = !!(n.id === selectedNode || (selectedNode && neighbours.has(n.id)));
      if (!wouldShow(n, isCtx)) continue;

      // Never suppress hovered or selected node labels — they're always readable
      const alwaysShow = n.id === hoveredNode || n.id === selectedNode;

      const r = nodeRadius(n.id, n.category);
      const display = n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label;
      const w = display.length * charW;
      const x1 = n.x - w / 2;
      const y1 = n.y + r + 2;
      const bbox = { x1, y1, x2: x1 + w, y2: y1 + lineH };

      if (!alwaysShow) {
        let overlaps = false;
        for (const c of committed) {
          if (bbox.x1 < c.x2 + 5 && bbox.x2 > c.x1 - 5 && bbox.y1 < c.y2 + 3 && bbox.y2 > c.y1 - 3) {
            overlaps = true;
            break;
          }
        }
        if (overlaps) { suppressed.add(n.id); continue; }
      }
      committed.push(bbox);
    }
    return suppressed;
  }, [simNodes, transform.k, hoveredNode, selectedNode, labelMode, neighbours, hubIds, degreeMap, nodeRadius]);

  // ── zoom (non-passive native wheel + pinch) ─────────────────
  // All zoom gestures keep the focal point (cursor or viewport centre) fixed by
  // adjusting the translate alongside the scale. Without this the graph flies to
  // the SVG origin on every zoom step.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const toSvg = (clientX: number, clientY: number) => {
      const r = el.getBoundingClientRect();
      return { x: (clientX - r.left) / r.width * 900, y: (clientY - r.top) / r.height * 700 };
    };

    const zoomAround = (svgX: number, svgY: number, factor: number) =>
      setTransform((t) => {
        const newK = clamp(t.k * factor, 0.2, 4);
        const px = (svgX - t.x) / t.k;
        const py = (svgY - t.y) / t.k;
        return { k: newK, x: svgX - px * newK, y: svgY - py * newK };
      });

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y } = toSvg(e.clientX, e.clientY);
      zoomAround(x, y, e.deltaY > 0 ? 0.92 : 1.08);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const mid = toSvg((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
      pinchRef.current = { dist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY), midX: mid.x, midY: mid.y };
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 2 || !pinchRef.current) return;
      e.preventDefault();
      const [t1, t2] = [e.touches[0], e.touches[1]];
      const newDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);
      const factor = newDist / pinchRef.current.dist;
      zoomAround(pinchRef.current.midX, pinchRef.current.midY, factor);
      const mid = toSvg((t1.clientX + t2.clientX) / 2, (t1.clientY + t2.clientY) / 2);
      pinchRef.current = { dist: newDist, midX: mid.x, midY: mid.y };
    };

    const onTouchEnd = () => { pinchRef.current = null; };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Zoom buttons use viewport centre (450, 350) as the fixed point
  const zoomBy = (f: number) =>
    setTransform((t) => {
      const newK = clamp(t.k * f, 0.2, 4);
      const px = (450 - t.x) / t.k;
      const py = (350 - t.y) / t.k;
      return { k: newK, x: 450 - px * newK, y: 350 - py * newK };
    });
  const resetView = () => setTransform({ x: 0, y: 0, k: 1 });

  // Zoom-to-fit: scales to show all currently rendered nodes with padding.
  const fitAll = useCallback(() => {
    if (simNodes.length === 0) return;
    const xs = simNodes.map((n) => n.x);
    const ys = simNodes.map((n) => n.y);
    const pad = 60;
    const minX = Math.min(...xs) - pad;
    const maxX = Math.max(...xs) + pad;
    const minY = Math.min(...ys) - pad;
    const maxY = Math.max(...ys) + pad;
    const k = clamp(Math.min(900 / (maxX - minX), 700 / (maxY - minY)), 0.15, 2.5);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setTransform({ k, x: 450 - cx * k, y: 350 - cy * k });
  }, [simNodes]);

  const selectedNodeData = selectedNode ? nodeMap.get(selectedNode) : undefined;
  const selectedEdges = useMemo(() => {
    if (!selectedNode) return { outgoing: [] as GraphEdge[], incoming: [] as GraphEdge[] };
    return {
      outgoing: data.edges.filter((e) => e.source === selectedNode),
      incoming: data.edges.filter((e) => e.target === selectedNode),
    };
  }, [selectedNode, data.edges]);

  const toggle = <T,>(set: React.Dispatch<React.SetStateAction<Set<T>>>, v: T) =>
    set((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });

  // Semantic-zoom label gate: labels only appear when zoom is high enough to read them.
  // Hub labels (agents/members/top-degree) show at k≥0.28 (always visible at default k=1).
  // All-other labels in "all" mode only show at k≥0.55, hiding the hairball at low zoom.
  const labelFor = (n: SimNode, isSelectedOrNeighbour: boolean): boolean => {
    if (isSelectedOrNeighbour || n.id === hoveredNode) return true;
    if (labelMode === "none") return false;
    const k = transform.k;
    if (labelMode === "all") return k >= 0.55;
    return hubIds.has(n.id) && k >= 0.28;
  };

  return (
    <div className="space-y-3">
      {/* controls */}
      <div className="flex flex-wrap items-center gap-2">
        {KINDS.map((k) => {
          const meta = PROVENANCE_META[k];
          const on = activeKinds.has(k);
          return (
            <button
              key={k}
              onClick={() => toggle(setActiveKinds, k)}
              className="flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors"
              style={{
                borderColor: on ? meta.color : "var(--border)",
                backgroundColor: on ? `${meta.color}1a` : "transparent",
                color: on ? meta.color : "var(--muted-foreground)",
              }}
            >
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: meta.color, opacity: on ? 1 : 0.3 }} />
              {meta.label}
            </button>
          );
        })}

        <FilterDropdown
          label="agent"
          options={AGENTS.map((a) => ({ id: a, label: AGENT_META[a].label, color: AGENT_META[a].color }))}
          selected={activeAgents}
          onToggle={(id) => toggle(setActiveAgents, id)}
          onClear={() => setActiveAgents(new Set())}
        />
        <FilterDropdown
          label="person"
          options={members}
          selected={activePersons}
          onToggle={(id) => toggle(setActivePersons, id)}
          onClear={() => setActivePersons(new Set())}
        />

        <button
          onClick={() => setProposalOnly((v) => !v)}
          className="rounded-full border px-2.5 py-1 text-xs transition-colors"
          style={{
            borderColor: proposalOnly ? "var(--foreground)" : "var(--border)",
            color: proposalOnly ? "var(--foreground)" : "var(--muted-foreground)",
          }}
          title="proposal-facing layer: members · skills · methods · frameworks · agents"
        >
          {proposalOnly ? "proposal-facing" : "everything"}
        </button>

        <button
          onClick={() => setShowLit((v) => !v)}
          className="rounded-full border px-2.5 py-1 text-xs transition-colors"
          style={{
            borderColor: showLit ? "var(--foreground)" : "var(--border)",
            color: showLit ? "var(--foreground)" : "var(--muted-foreground)",
          }}
          title="overlay cARL's annotated bibliography (literature grounding the concepts)"
        >
          {showLit ? "literature ✓" : "+ literature"}
        </button>

        <button
          onClick={() => setLabelMode((m) => (m === "hubs" ? "all" : m === "all" ? "none" : "hubs"))}
          className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          title="how many labels to show"
        >
          labels: {labelMode}
        </button>

        {focusId && (
          <button
            onClick={() => setFocusId(null)}
            className="rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-xs text-amber-600 transition-colors dark:text-amber-400"
          >
            ✕ unpin {nodeMap.get(focusId)?.label ?? ""}
          </button>
        )}

        <input
          type="text"
          placeholder="search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="ml-auto rounded-md border border-border bg-background px-2.5 py-1 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      {/* graph + persistent drawer */}
      <div className="flex gap-3">
        <div
          ref={containerRef}
          className="relative flex-1 overflow-hidden rounded-lg border border-border bg-card"
          style={{ minHeight: 560 }}
        >
          <svg
            ref={svgRef}
            viewBox="0 0 900 700"
            className="h-full w-full"
            style={{ cursor: dragRef.current ? "grabbing" : "grab" }}
            onMouseDown={(e) => {
              dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
            }}
            onMouseMove={(e) => {
              const d = dragRef.current;
              if (!d) return;
              const dx = e.clientX - d.x;
              const dy = e.clientY - d.y;
              if (Math.abs(dx) + Math.abs(dy) > 1) {
                d.moved = true;
                setTransform((t) => ({ ...t, x: t.x + dx * 1.4, y: t.y + dy * 1.4 }));
                d.x = e.clientX;
                d.y = e.clientY;
              }
            }}
            onMouseUp={() => {
              dragRef.current = null;
            }}
            onMouseLeave={() => {
              dragRef.current = null;
            }}
            onClick={(e) => {
              if ((e.target === svgRef.current || (e.target as Element).tagName === "svg") && !dragRef.current) {
                setSelectedNode(null);
              }
            }}
          >
            <g transform={`translate(${transform.x},${transform.y}) scale(${transform.k})`}>
              {simEdges.map((e, i) => {
                const isBridge = e.relationship === "same-as";
                const dim = selectedNode && !neighbours.has(e.source.id) && !neighbours.has(e.target.id);
                return (
                  <line
                    key={i}
                    x1={e.source.x}
                    y1={e.source.y}
                    x2={e.target.x}
                    y2={e.target.y}
                    stroke={isBridge ? PROVENANCE_META.shared.color : dim ? "var(--border)" : "var(--muted-foreground)"}
                    strokeOpacity={dim ? 0.05 : isBridge ? 0.7 : 0.22}
                    strokeWidth={isBridge ? 1.5 : 1}
                    strokeDasharray={isBridge ? "4 3" : undefined}
                    pointerEvents="none"
                  />
                );
              })}

              {[...simNodes]
                .sort((a, b) => {
                  const rank = (n: SimNode) =>
                    n.id === hoveredNode ? 2 : n.id === selectedNode ? 1 : 0;
                  return rank(a) - rank(b);
                })
                .map((n) => {
                const r = nodeRadius(n.id, n.category);
                const color = getNodeColor(n);
                const dim = selectedNode && !neighbours.has(n.id);
                const isSelected = n.id === selectedNode;
                const isHovered = n.id === hoveredNode;
                const isStale = stale.has(n.id);
                const showLabel = !suppressedLabels.has(n.id) && labelFor(n, !!(isSelected || (selectedNode && neighbours.has(n.id))) || isHovered);
                return (
                  <g
                    key={n.id}
                    style={{ cursor: "pointer" }}
                    onMouseEnter={() => setHoveredNode(n.id)}
                    onMouseLeave={() => setHoveredNode((h) => (h === n.id ? null : h))}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      if (!dragRef.current?.moved) setSelectedNode(n.id);
                    }}
                  >
                    {(isSelected || isHovered) && (
                      <circle cx={n.x} cy={n.y} r={r + 4} fill="none" stroke={color} strokeWidth={2} strokeOpacity={0.5} />
                    )}
                    {isStale && (
                      <circle cx={n.x} cy={n.y} r={r + 3} fill="none" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="2 2" opacity={dim ? 0.2 : 0.9} />
                    )}
                    <circle
                      cx={n.x}
                      cy={n.y}
                      r={r}
                      fill={color}
                      fillOpacity={dim ? 0.15 : n.category === "agent" ? 1 : 0.78}
                    />
                    {showLabel && (
                      <text
                        x={n.x}
                        y={n.y + r + 10}
                        textAnchor="middle"
                        fill="var(--foreground)"
                        fontSize={isHovered ? 11 : 9}
                        fontWeight={isHovered || hubIds.has(n.id) ? 600 : 400}
                        opacity={dim ? 0.3 : 0.85}
                        pointerEvents="none"
                      >
                        {n.label.length > 22 ? n.label.slice(0, 20) + "…" : n.label}
                      </text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {/* zoom controls */}
          <div className="absolute right-2 top-2 flex flex-col gap-1">
            <button onClick={() => zoomBy(1.2)} className="h-7 w-7 rounded border border-border bg-background/90 text-sm text-foreground backdrop-blur hover:bg-muted">+</button>
            <button onClick={() => zoomBy(0.83)} className="h-7 w-7 rounded border border-border bg-background/90 text-sm text-foreground backdrop-blur hover:bg-muted">−</button>
            <button onClick={fitAll} className="h-7 w-7 rounded border border-border bg-background/90 text-[10px] text-foreground backdrop-blur hover:bg-muted" title="fit all nodes">⊡</button>
            <button onClick={resetView} className="h-7 w-7 rounded border border-border bg-background/90 text-[10px] text-foreground backdrop-blur hover:bg-muted" title="reset to 100%">⤢</button>
          </div>

          {/* stats */}
          <div className="absolute bottom-2 left-2 flex gap-3 rounded bg-background/80 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur">
            <span>{filteredNodes.length} nodes</span>
            <span>{filteredEdges.length} edges</span>
            <span>{(transform.k * 100).toFixed(0)}%</span>
          </div>

          {!drawerOpen && (
            <button
              onClick={() => setDrawerOpen(true)}
              className="absolute right-2 bottom-2 rounded border border-border bg-background/90 px-2 py-1 text-[10px] text-muted-foreground backdrop-blur hover:bg-muted"
            >
              ‹ details
            </button>
          )}
        </div>

        {/* persistent drawer */}
        {drawerOpen && (
          <div className="w-72 shrink-0 space-y-3 rounded-lg border border-border bg-card p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {selectedNodeData ? "node" : "legend"}
              </h3>
              <button onClick={() => setDrawerOpen(false)} className="text-xs text-muted-foreground hover:text-foreground" title="collapse">
                ›
              </button>
            </div>

            {!selectedNodeData && <Legend />}

            {selectedNodeData && (
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: getNodeColor(selectedNodeData) }} />
                    <h4 className="text-sm font-semibold">{selectedNodeData.label}</h4>
                  </div>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {selectedNodeData.category} · {nodeKind(selectedNodeData)}
                    {selectedNodeData.source ? ` · ${selectedNodeData.source}` : ""}
                    {stale.has(selectedNodeData.id) ? " · ⚠ stale" : ""}
                  </p>
                </div>
                {selectedNodeData.description && (
                  <p className="text-xs leading-relaxed text-muted-foreground">{selectedNodeData.description}</p>
                )}

                <button
                  onClick={() => setFocusId(focusId === selectedNodeData.id ? null : selectedNodeData.id)}
                  className="w-full rounded border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-muted"
                >
                  {focusId === selectedNodeData.id ? "show full graph" : "pin to this node's constellation"}
                </button>

                {selectedEdges.outgoing.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">outgoing</p>
                    <ul className="max-h-40 space-y-0.5 overflow-auto">
                      {selectedEdges.outgoing.map((e, i) => (
                        <li key={i} className="text-xs">
                          <button className="text-left hover:underline" onClick={() => setSelectedNode(e.target)}>
                            <span className="text-muted-foreground">{e.relationship} →</span> {nodeMap.get(e.target)?.label ?? e.target}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {selectedEdges.incoming.length > 0 && (
                  <div>
                    <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">incoming</p>
                    <ul className="max-h-40 space-y-0.5 overflow-auto">
                      {selectedEdges.incoming.map((e, i) => (
                        <li key={i} className="text-xs">
                          <button className="text-left hover:underline" onClick={() => setSelectedNode(e.source)}>
                            {nodeMap.get(e.source)?.label ?? e.source} <span className="text-muted-foreground">→ {e.relationship}</span>
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
        )}
      </div>
    </div>
  );
}
