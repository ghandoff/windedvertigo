"use client";

import { useMemo, useCallback, useEffect, useState, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Controls,
  MiniMap,
  Background,
  BackgroundVariant,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeMarkerType,
  MarkerType,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import dagre from "dagre";
import { useRouter } from "next/navigation";
import type { TreeNode, ColorMode, RelationshipType } from "@/lib/types";
import { PersonNode, type PersonNodeData } from "./person-node";
import { UnionNode } from "./union-node";

const NODE_WIDTH = 180;
const NODE_HEIGHT = 70;
const UNION_WIDTH = 24;
const UNION_HEIGHT = 24;

const nodeTypes = { person: PersonNode, union: UnionNode };

function hashSurname(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 12;
}

function computeCompleteness(n: TreeNode): number {
  let score = 0;
  if (n.birthYear) score++;
  if (n.deathYear || n.isLiving) score++;
  if (n.displayName && n.displayName !== "unknown") score++;
  if (n.thumbnailUrl) score++;
  return score;
}

/** edge style per parent relationship type */
function parentEdgeStyle(type: RelationshipType): React.CSSProperties {
  const base = { strokeWidth: 2 };
  switch (type) {
    case "biological_parent":
      return { ...base, stroke: "var(--color-border)" };
    case "adoptive_parent":
      return { ...base, stroke: "var(--color-border)", strokeDasharray: "8 4" };
    case "step_parent":
      return { ...base, stroke: "var(--color-border)", strokeDasharray: "2 3" };
    case "foster_parent":
      return { ...base, stroke: "var(--color-border)", strokeDasharray: "10 3 2 3" };
    case "guardian":
      return { ...base, stroke: "var(--color-border)", strokeDasharray: "4 6" };
    default:
      return { ...base, stroke: "var(--color-border)" };
  }
}

/** readable label for relationship type */
function relLabel(type: RelationshipType): string {
  return type.replace(/_/g, " ");
}

/**
 * Identify "couple units" — pairs of people who co-parent at least one child.
 * Each couple gets a union junction node; children descend from the junction
 * instead of having duplicate edges from each parent.
 */
function findCoupleUnits(treeNodes: TreeNode[]) {
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));

  // map: sorted "p1--p2" → set of shared child ids
  const coupleChildren = new Map<string, Set<string>>();
  // track which children are routed through a couple junction
  const childHandledByCouple = new Map<string, string>(); // childId → coupleKey

  for (const child of treeNodes) {
    if (child.parentIds.length >= 2) {
      // for each pair of parents, check if they share this child
      for (let i = 0; i < child.parentIds.length; i++) {
        for (let j = i + 1; j < child.parentIds.length; j++) {
          const key = [child.parentIds[i], child.parentIds[j]].sort().join("--");
          const set = coupleChildren.get(key) ?? new Set();
          set.add(child.id);
          coupleChildren.set(key, set);
          childHandledByCouple.set(child.id, key);
        }
      }
    }
  }

  return { coupleChildren, childHandledByCouple, nodeMap };
}

function layoutTree(treeNodes: TreeNode[], colorMode: ColorMode): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({
    rankdir: "TB",
    ranksep: 120,
    nodesep: 60,
    marginx: 40,
    marginy: 40,
  });

  const { coupleChildren, childHandledByCouple, nodeMap } = findCoupleUnits(treeNodes);

  // compute generation depths via BFS from roots
  const generations = new Map<string, number>();
  const roots = treeNodes.filter((n) => n.parentIds.length === 0);
  const queue = roots.map((r) => ({ id: r.id, gen: 0 }));
  const visited = new Set<string>();

  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    generations.set(id, gen);

    const node = nodeMap.get(id);
    if (node) {
      for (const childId of node.childIds) {
        if (!visited.has(childId)) {
          queue.push({ id: childId, gen: gen + 1 });
        }
      }
    }
  }

  for (const n of treeNodes) {
    if (!generations.has(n.id)) generations.set(n.id, 0);
  }

  // add person nodes to dagre
  for (const n of treeNodes) {
    g.setNode(n.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
  }

  // add union junction nodes for each couple with shared children
  const unionNodes: { id: string; key: string; p1: string; p2: string; relType: string; label: string }[] = [];

  const processedSpouseKeys = new Set<string>();

  for (const n of treeNodes) {
    for (let i = 0; i < n.spouseIds.length; i++) {
      const spouseId = n.spouseIds[i];
      const key = [n.id, spouseId].sort().join("--");
      if (processedSpouseKeys.has(key)) continue;
      processedSpouseKeys.add(key);

      const edgeMeta = n.spouseEdges[i];
      const relType = edgeMeta?.type ?? "spouse";
      const marriageYear = edgeMeta?.startDate ?? null;

      // build label
      let symbol = "=";
      if (relType === "ex_spouse") symbol = "÷";
      else if (relType === "partner") symbol = "♡";
      const label = marriageYear ? `${symbol} ${marriageYear}` : symbol;

      const hasSharedChildren = coupleChildren.has(key);

      if (hasSharedChildren) {
        // create a union node
        const unionId = `union-${key}`;
        unionNodes.push({ id: unionId, key, p1: key.split("--")[0], p2: key.split("--")[1], relType, label });
        g.setNode(unionId, { width: UNION_WIDTH, height: UNION_HEIGHT });

        // edges: parent1 → union, parent2 → union (keeps them on same rank)
        g.setEdge(key.split("--")[0], unionId, { weight: 3, minlen: 0 });
        g.setEdge(key.split("--")[1], unionId, { weight: 3, minlen: 0 });

        // edges: union → each shared child
        const children = coupleChildren.get(key)!;
        for (const childId of children) {
          g.setEdge(unionId, childId);
        }
      } else {
        // no shared children — just constrain spouses to same rank
        g.setEdge(n.id, spouseId, { weight: 2, minlen: 0 });
      }
    }
  }

  // create union nodes for co-parents who share children but are NOT listed as spouses.
  // without this, their children get marked as "handled by couple" but no union node
  // exists, leaving them with no edges in the graph.
  for (const [key, children] of coupleChildren) {
    if (processedSpouseKeys.has(key)) continue; // already handled as spouse pair

    const [p1, p2] = key.split("--");
    const unionId = `union-${key}`;
    unionNodes.push({ id: unionId, key, p1, p2, relType: "biological_parent", label: "" });
    g.setNode(unionId, { width: UNION_WIDTH, height: UNION_HEIGHT });

    g.setEdge(p1, unionId, { weight: 3, minlen: 0 });
    g.setEdge(p2, unionId, { weight: 3, minlen: 0 });

    for (const childId of children) {
      g.setEdge(unionId, childId);
    }
  }

  // build React Flow edges
  const edges: Edge[] = [];

  // spouse connector edges (through union nodes where applicable)
  for (const union of unionNodes) {
    // parent1 → union
    edges.push({
      id: `${union.p1}->${union.id}`,
      source: union.p1,
      target: union.id,
      type: "straight",
      style: {
        stroke: union.relType === "ex_spouse" ? "var(--color-muted-foreground)" : "var(--color-accent)",
        strokeWidth: 2,
        strokeDasharray: union.relType === "ex_spouse" ? "4 4" : undefined,
      },
      data: { relType: union.relType },
    });
    // parent2 → union
    edges.push({
      id: `${union.p2}->${union.id}`,
      source: union.p2,
      target: union.id,
      type: "straight",
      style: {
        stroke: union.relType === "ex_spouse" ? "var(--color-muted-foreground)" : "var(--color-accent)",
        strokeWidth: 2,
        strokeDasharray: union.relType === "ex_spouse" ? "4 4" : undefined,
      },
      data: { relType: union.relType },
    });

    // union → shared children
    const children = coupleChildren.get(union.key)!;
    for (const childId of children) {
      const child = nodeMap.get(childId);
      // find the edge metadata from the child's perspective
      let relType: RelationshipType = "biological_parent";
      if (child) {
        for (let i = 0; i < child.parentIds.length; i++) {
          if (child.parentIds[i] === union.p1 || child.parentIds[i] === union.p2) {
            relType = child.parentEdges[i]?.type ?? "biological_parent";
            break;
          }
        }
      }

      edges.push({
        id: `${union.id}->${childId}`,
        source: union.id,
        target: childId,
        type: "smoothstep",
        style: parentEdgeStyle(relType),
        data: { relType },
      });
    }
  }

  // spouse-only edges (couples with no shared children)
  for (const n of treeNodes) {
    for (let i = 0; i < n.spouseIds.length; i++) {
      const spouseId = n.spouseIds[i];
      const key = [n.id, spouseId].sort().join("--");
      // skip if already handled by union node
      if (unionNodes.some((u) => u.key === key)) continue;
      // skip duplicates (only process once per pair)
      if (n.id !== key.split("--")[0]) continue;

      const edgeMeta = n.spouseEdges[i];
      const relType = edgeMeta?.type ?? "spouse";
      const marriageYear = edgeMeta?.startDate ?? null;

      let symbol = "=";
      if (relType === "ex_spouse") symbol = "÷";
      else if (relType === "partner") symbol = "♡";
      const label = marriageYear ? `${symbol} ${marriageYear}` : symbol;

      edges.push({
        id: `spouse-${key}`,
        source: n.id,
        target: spouseId,
        type: "straight",
        style: {
          stroke: relType === "ex_spouse" ? "var(--color-muted-foreground)" : "var(--color-accent)",
          strokeWidth: 2,
          strokeDasharray: relType === "ex_spouse" ? "4 4" : undefined,
        },
        label,
        labelStyle: { fontSize: 11, fill: "var(--color-muted-foreground)", fontWeight: 500 },
        labelBgStyle: { fill: "var(--color-background)", fillOpacity: 0.85 },
        labelBgPadding: [4, 2] as [number, number],
        data: { relType },
      });
    }
  }

  // direct parent→child edges for children NOT routed through a couple junction
  for (const n of treeNodes) {
    if (childHandledByCouple.has(n.id)) continue; // routed through union node

    for (let i = 0; i < n.parentIds.length; i++) {
      const parentId = n.parentIds[i];
      const edgeMeta = n.parentEdges[i];
      const relType = edgeMeta?.type ?? "biological_parent";

      g.setEdge(parentId, n.id);
      edges.push({
        id: `${parentId}->${n.id}`,
        source: parentId,
        target: n.id,
        type: "smoothstep",
        style: parentEdgeStyle(relType),
        data: { relType },
      });
    }
  }

  dagre.layout(g);

  // build surname index map
  const uniqueSurnames = [...new Set(
    treeNodes.map((n) => n.surname).filter((s): s is string => !!s),
  )];
  const surnameIndexMap = new Map<string, number>();
  for (const s of uniqueSurnames) {
    surnameIndexMap.set(s, hashSurname(s));
  }

  const nodes: Node[] = treeNodes.map((n) => {
    const pos = g.node(n.id);
    return {
      id: n.id,
      type: "person",
      draggable: true,
      position: {
        x: (pos?.x ?? 0) - NODE_WIDTH / 2,
        y: (pos?.y ?? 0) - NODE_HEIGHT / 2,
      },
      data: {
        ...n,
        generation: generations.get(n.id) ?? 0,
        colorMode,
        surnameIndex: n.surname ? (surnameIndexMap.get(n.surname) ?? -1) : -1,
        completenessScore: computeCompleteness(n),
      } satisfies PersonNodeData,
    };
  });

  // add union junction nodes
  for (const union of unionNodes) {
    const pos = g.node(union.id);
    if (pos) {
      nodes.push({
        id: union.id,
        type: "union",
        draggable: true,
        position: {
          x: (pos.x ?? 0) - UNION_WIDTH / 2,
          y: (pos.y ?? 0) - UNION_HEIGHT / 2,
        },
        data: {
          relType: union.relType,
          label: union.label,
        },
      });
    }
  }

  return { nodes, edges };
}

/** find siblings of a node (people who share at least one parent) */
function getSiblings(nodeId: string, treeNodes: TreeNode[]): string[] {
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));
  const node = nodeMap.get(nodeId);
  if (!node || node.parentIds.length === 0) return [];

  const siblings = new Set<string>();
  for (const parentId of node.parentIds) {
    const parent = nodeMap.get(parentId);
    if (parent) {
      for (const childId of parent.childIds) {
        if (childId !== nodeId) siblings.add(childId);
      }
    }
  }
  return [...siblings];
}

function PedigreeChartInner({ nodes: treeNodes, colorMode = "sex" }: { nodes: TreeNode[]; colorMode?: ColorMode }) {
  const router = useRouter();
  const { setCenter, getNodes, fitView } = useReactFlow();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hasManualPositions, setHasManualPositions] = useState(false);
  const initialLayoutDone = useRef(false);

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => layoutTree(treeNodes, colorMode),
    [treeNodes, colorMode],
  );

  // apply focused styling
  const styledNodes = useMemo(() => {
    return layoutNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isFocused: n.id === focusedNodeId,
      },
    }));
  }, [layoutNodes, focusedNodeId]);

  const [nodes, setNodes, onNodesChange] = useNodesState(styledNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  // sync layout when treeNodes or colorMode changes
  useEffect(() => {
    setNodes(styledNodes);
    setEdges(layoutEdges);
    setHasManualPositions(false);
  }, [styledNodes, layoutEdges, setNodes, setEdges]);

  // fit view after initial layout
  useEffect(() => {
    if (!initialLayoutDone.current && treeNodes.length > 0) {
      initialLayoutDone.current = true;
      // small delay to let react flow measure
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 100);
      return () => clearTimeout(timer);
    }
  }, [treeNodes.length, fitView]);

  const treeNodeMap = useMemo(
    () => new Map(treeNodes.map((n) => [n.id, n])),
    [treeNodes],
  );

  /** handle node drag — track that we have manual positions */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // detect position changes (drags)
      const hasDrag = changes.some((c) => c.type === "position" && (c as { dragging?: boolean }).dragging);
      if (hasDrag) setHasManualPositions(true);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodesChange(changes as any);
    },
    [onNodesChange],
  );

  /** reset layout to auto-computed dagre positions */
  const resetLayout = useCallback(() => {
    const { nodes: fresh, edges: freshEdges } = layoutTree(treeNodes, colorMode);
    const freshStyled = fresh.map((n) => ({
      ...n,
      data: { ...n.data, isFocused: n.id === focusedNodeId },
    }));
    setNodes(freshStyled);
    setEdges(freshEdges);
    setHasManualPositions(false);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [treeNodes, colorMode, focusedNodeId, setNodes, setEdges, fitView]);

  const panToNode = useCallback(
    (nodeId: string) => {
      const rfNodes = getNodes();
      const target = rfNodes.find((n) => n.id === nodeId);
      if (target) {
        setCenter(
          target.position.x + NODE_WIDTH / 2,
          target.position.y + NODE_HEIGHT / 2,
          { zoom: 1.2, duration: 300 },
        );
      }
      setFocusedNodeId(nodeId);
    },
    [getNodes, setCenter],
  );

  // handle node click to set focus
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setFocusedNodeId(node.id);
    },
    [],
  );

  // keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // don't intercept if typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (!focusedNodeId) return;
      const node = treeNodeMap.get(focusedNodeId);
      if (!node) return;

      switch (e.key) {
        case "ArrowUp": {
          e.preventDefault();
          if (node.parentIds.length > 0) {
            panToNode(node.parentIds[0]);
          }
          break;
        }
        case "ArrowDown": {
          e.preventDefault();
          if (node.childIds.length > 0) {
            panToNode(node.childIds[0]);
          }
          break;
        }
        case "ArrowLeft": {
          e.preventDefault();
          const siblings = getSiblings(focusedNodeId, treeNodes);
          if (siblings.length > 0) {
            const currentIdx = siblings.indexOf(focusedNodeId);
            const prevIdx = currentIdx > 0 ? currentIdx - 1 : siblings.length - 1;
            panToNode(siblings[prevIdx] ?? siblings[0]);
          }
          break;
        }
        case "ArrowRight": {
          e.preventDefault();
          const sibs = getSiblings(focusedNodeId, treeNodes);
          if (sibs.length > 0) {
            const currIdx = sibs.indexOf(focusedNodeId);
            const nextIdx = currIdx < sibs.length - 1 ? currIdx + 1 : 0;
            panToNode(sibs[nextIdx] ?? sibs[0]);
          }
          break;
        }
        case "Tab": {
          e.preventDefault();
          if (node.spouseIds.length > 0) {
            panToNode(node.spouseIds[0]);
          }
          break;
        }
        case "Enter": {
          e.preventDefault();
          router.push(`/person/${focusedNodeId}`);
          break;
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedNodeId, treeNodeMap, treeNodes, panToNode, router]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      nodesDraggable
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Controls position="bottom-right" />
      <MiniMap
        nodeStrokeWidth={3}
        zoomable
        pannable
        position="bottom-left"
        className="!bg-background/80 !border-border"
      />
      <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />

      {/* reset layout button — only visible after manual drag */}
      {hasManualPositions && (
        <Panel position="top-left" className="!ml-2 !mt-14">
          <button
            onClick={resetLayout}
            className="rounded-md bg-card/90 backdrop-blur-sm border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
            title="reset to auto layout"
          >
            ↻ reset layout
          </button>
        </Panel>
      )}

      {/* edge legend */}
      <Panel position="bottom-right" className="!mr-2 !mb-14">
        <div className="rounded-md bg-card/90 backdrop-blur-sm border border-border px-2.5 py-2 text-[10px] text-muted-foreground space-y-1 shadow-sm">
          <div className="flex items-center gap-2">
            <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" /></svg>
            <span>biological</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray="8 4" /></svg>
            <span>adoptive</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray="2 3" /></svg>
            <span>step</span>
          </div>
          <div className="flex items-center gap-2">
            <svg width="24" height="4"><line x1="0" y1="2" x2="24" y2="2" stroke="currentColor" strokeWidth="2" strokeDasharray="10 3 2 3" /></svg>
            <span>foster</span>
          </div>
        </div>
      </Panel>

      {/* focused node highlight overlay — rendered via CSS on the node itself */}
      <style>{`
        .react-flow__node[data-id="${focusedNodeId}"] > div > div {
          box-shadow: 0 0 0 3px hsl(var(--ring, 215 20% 65%)), 0 0 12px hsl(var(--ring, 215 20% 65%) / 0.3);
        }
      `}</style>
    </ReactFlow>
  );
}

export function PedigreeChart({ nodes, colorMode }: { nodes: TreeNode[]; colorMode?: ColorMode }) {
  return (
    <ReactFlowProvider>
      <PedigreeChartInner nodes={nodes} colorMode={colorMode} />
    </ReactFlowProvider>
  );
}
