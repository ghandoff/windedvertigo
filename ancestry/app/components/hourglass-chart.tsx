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
  type NodeChange,
  Panel,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useRouter } from "next/navigation";
import type { TreeNode, ColorMode, PersonEvent } from "@/lib/types";
import { layoutPedigree } from "@/lib/tree-layout";
import { PersonNode } from "./person-node";
import { UnionNode } from "./union-node";
import { useCollapse } from "./use-collapse";
import { PersonDetailPanel } from "./person-detail-panel";
import { NodeContextMenu } from "./node-context-menu";
import { getHelperLines, HelperLinesRenderer, type HelperLinePosition } from "./helper-lines";
import { AlignmentToolbar } from "./alignment-toolbar";
import { useUndoRedo } from "./use-undo-redo";
import { SmartStepEdge } from "@jalez/react-flow-smart-edge";

const NODE_WIDTH = 120;
const NODE_HEIGHT = 100;
const DEFAULT_ANCESTOR_DEPTH = 4;
const DEFAULT_DESCENDANT_DEPTH = 4;

const nodeTypes = { person: PersonNode, union: UnionNode };
const edgeTypes = { smart: SmartStepEdge };

/** BFS in both directions from focal person, limited by depth */
function getHourglassSubset(
  rootId: string,
  treeNodes: TreeNode[],
  ancestorDepth: number,
  descendantDepth: number,
): TreeNode[] {
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));
  const included = new Set<string>();

  // BFS up through parents
  const upQueue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
  while (upQueue.length > 0) {
    const { id, depth } = upQueue.shift()!;
    if (included.has(id) && id !== rootId) continue;
    included.add(id);

    if (depth < ancestorDepth) {
      const node = nodeMap.get(id);
      if (node) {
        for (const pid of node.parentIds) {
          if (!included.has(pid)) upQueue.push({ id: pid, depth: depth + 1 });
        }
        // include spouses of ancestors for couple unions
        for (const sid of node.spouseIds) {
          included.add(sid);
        }
      }
    }
  }

  // BFS down through children
  const downQueue: { id: string; depth: number }[] = [{ id: rootId, depth: 0 }];
  const visitedDown = new Set<string>();
  while (downQueue.length > 0) {
    const { id, depth } = downQueue.shift()!;
    if (visitedDown.has(id)) continue;
    visitedDown.add(id);
    included.add(id);

    if (depth < descendantDepth) {
      const node = nodeMap.get(id);
      if (node) {
        for (const cid of node.childIds) {
          if (!visitedDown.has(cid)) downQueue.push({ id: cid, depth: depth + 1 });
        }
        // include spouses of descendants for couple unions
        for (const sid of node.spouseIds) {
          included.add(sid);
        }
      }
    }
  }

  return treeNodes
    .filter((n) => included.has(n.id))
    .map((n) => ({
      ...n,
      parentIds: n.parentIds.filter((id) => included.has(id)),
      childIds: n.childIds.filter((id) => included.has(id)),
      spouseIds: n.spouseIds.filter((id) => included.has(id)),
      parentEdges: n.parentEdges.filter((_, i) => included.has(n.parentIds[i])),
      spouseEdges: n.spouseEdges.filter((_, i) => included.has(n.spouseIds[i])),
    }));
}

function HourglassChartInner({
  nodes: treeNodes,
  rootId,
  colorMode = "sex",
  events = [],
}: {
  nodes: TreeNode[];
  rootId: string;
  colorMode?: ColorMode;
  events?: PersonEvent[];
}) {
  const router = useRouter();
  const { setCenter, getNodes, fitView } = useReactFlow();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hasManualPositions, setHasManualPositions] = useState(false);
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ personId: string; x: number; y: number } | null>(null);
  const [helperLines, setHelperLines] = useState<HelperLinePosition>({});
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [ancestorDepth, setAncestorDepth] = useState(DEFAULT_ANCESTOR_DEPTH);
  const [descendantDepth, setDescendantDepth] = useState(DEFAULT_DESCENDANT_DEPTH);
  const initialLayoutDone = useRef(false);

  const filteredNodes = useMemo(
    () => getHourglassSubset(rootId, treeNodes, ancestorDepth, descendantDepth),
    [rootId, treeNodes, ancestorDepth, descendantDepth],
  );

  const { visibleNodes, collapsedIds, collapsibleIds, toggleCollapse } = useCollapse(filteredNodes);
  const { canUndo, canRedo, takeSnapshot, undo, redo } = useUndoRedo();

  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(
    () => layoutPedigree(visibleNodes, rootId, colorMode),
    [visibleNodes, rootId, colorMode],
  );

  const styledNodes = useMemo(() => {
    return layoutNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isFocused: n.id === focusedNodeId,
        isCollapsible: collapsibleIds.has(n.id),
        isCollapsed: collapsedIds.has(n.id),
        onToggleCollapse: toggleCollapse,
        onContextMenu: (personId: string, x: number, y: number) => setContextMenu({ personId, x, y }),
        onOpenDetail: (personId: string) => setDetailPersonId(personId),
      },
    }));
  }, [layoutNodes, focusedNodeId, collapsibleIds, collapsedIds, toggleCollapse]);

  const [nodes, setNodes, onNodesChange] = useNodesState(styledNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutEdges);

  useEffect(() => {
    setNodes(styledNodes);
    setEdges(layoutEdges);
    setHasManualPositions(false);
  }, [styledNodes, layoutEdges, setNodes, setEdges]);

  useEffect(() => {
    if (filteredNodes.length > 0) {
      initialLayoutDone.current = true;
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // re-fit when depth changes
  useEffect(() => {
    if (initialLayoutDone.current) {
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    }
  }, [ancestorDepth, descendantDepth, fitView]);

  // track selected nodes for alignment toolbar
  const onSelectionChange = useCallback(({ nodes: selected }: { nodes: Node[] }) => {
    setSelectedNodeIds(selected.map((n) => n.id));
  }, []);

  // handle alignment from toolbar
  const handleAlign = useCallback(
    (positions: Record<string, { x: number; y: number }>) => {
      takeSnapshot();
      setNodes((nds) =>
        nds.map((n) => {
          const pos = positions[n.id];
          return pos ? { ...n, position: pos } : n;
        }),
      );
      setHasManualPositions(true);
    },
    [setNodes, takeSnapshot],
  );

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // detect drag-end — take undo snapshot
      const dragEndChanges = changes.filter(
        (c) =>
          c.type === "position" &&
          !(c as { dragging?: boolean }).dragging &&
          (c as { position?: { x: number; y: number } }).position,
      );

      if (dragEndChanges.length > 0) {
        setHasManualPositions(true);
        setHelperLines({});
        takeSnapshot();
      }

      // detect active dragging — apply helper line snapping
      const activeDrags = changes.filter(
        (c) => c.type === "position" && (c as { dragging?: boolean }).dragging && (c as { position?: { x: number; y: number } }).position,
      );

      if (activeDrags.length > 0) {
        setHasManualPositions(true);
        const drag = activeDrags[0] as { id: string; position: { x: number; y: number } };
        const currentNodes = getNodes();
        const result = getHelperLines(
          { id: drag.id, position: drag.position },
          currentNodes,
          selectedNodeIds,
        );
        setHelperLines({ horizontal: result.horizontal, vertical: result.vertical, isSelectionSnap: result.isSelectionSnap });
        if (result.horizontal !== undefined || result.vertical !== undefined) {
          drag.position = result.snapPosition;
        }
      } else if (dragEndChanges.length === 0) {
        const hasAnyDrag = changes.some(
          (c) => c.type === "position" && (c as { dragging?: boolean }).dragging,
        );
        if (!hasAnyDrag) setHelperLines({});
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      onNodesChange(changes as any);
    },
    [onNodesChange, getNodes, takeSnapshot],
  );

  const resetLayout = useCallback(() => {
    const { nodes: fresh, edges: freshEdges } = layoutPedigree(visibleNodes, rootId, colorMode);
    const freshStyled = fresh.map((n) => ({
      ...n,
      data: {
        ...n.data,
        isFocused: n.id === focusedNodeId,
        isCollapsible: collapsibleIds.has(n.id),
        isCollapsed: collapsedIds.has(n.id),
        onToggleCollapse: toggleCollapse,
        onContextMenu: (personId: string, x: number, y: number) => setContextMenu({ personId, x, y }),
        onOpenDetail: (personId: string) => setDetailPersonId(personId),
      },
    }));
    setNodes(freshStyled);
    setEdges(freshEdges);
    setHasManualPositions(false);
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [visibleNodes, rootId, colorMode, focusedNodeId, collapsibleIds, collapsedIds, toggleCollapse, setNodes, setEdges, fitView]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setFocusedNodeId(node.id);
    setDetailPersonId(node.id);
  }, []);

  const onNodeDoubleClick = useCallback((_: React.MouseEvent, node: Node) => {
    if (node.type === "union") return;
    router.push(`/person/${node.id}`);
  }, [router]);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setDetailPersonId(null);
  }, []);

  const handleDeletePerson = useCallback(async (personId: string) => {
    try {
      await fetch(`/api/person/${personId}`, { method: "DELETE" });
      window.location.reload();
    } catch {}
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key === "Enter" && focusedNodeId) {
        e.preventDefault();
        router.push(`/person/${focusedNodeId}`);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [focusedNodeId, router]);

  return (
    <>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        onSelectionChange={onSelectionChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesDraggable
        snapToGrid
        snapGrid={[20, 20]}
        selectionKeyCode="Shift"
        multiSelectionKeyCode="Shift"
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Controls position="bottom-right" />
        <MiniMap nodeStrokeWidth={3} zoomable pannable position="bottom-left" className="!bg-background/80 !border-border" />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />

        {/* alignment helper lines */}
        <HelperLinesRenderer horizontal={helperLines.horizontal} vertical={helperLines.vertical} isSelectionSnap={helperLines.isSelectionSnap} />

        {/* alignment toolbar for multi-select */}
        {selectedNodeIds.length >= 2 && (
          <Panel position="top-right" className="!mr-2 !mt-14">
            <AlignmentToolbar selectedNodeIds={selectedNodeIds} onAlign={handleAlign} />
          </Panel>
        )}

        {/* depth controls + undo/redo + reset layout */}
        <Panel position="top-left" className="!ml-2 !mt-14">
          <div className="space-y-2">
            <div className="rounded-md bg-card/90 backdrop-blur-sm border border-border px-3 py-2 shadow-sm space-y-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-20">ancestors</span>
                <button
                  onClick={() => setAncestorDepth((d) => Math.max(1, d - 1))}
                  className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
                >
                  −
                </button>
                <span className="w-4 text-center font-medium">{ancestorDepth}</span>
                <button
                  onClick={() => setAncestorDepth((d) => Math.min(10, d + 1))}
                  className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
                >
                  +
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground w-20">descendants</span>
                <button
                  onClick={() => setDescendantDepth((d) => Math.max(1, d - 1))}
                  className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
                >
                  −
                </button>
                <span className="w-4 text-center font-medium">{descendantDepth}</span>
                <button
                  onClick={() => setDescendantDepth((d) => Math.min(10, d + 1))}
                  className="w-6 h-6 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm"
                >
                  +
                </button>
              </div>
            </div>

            <div className="flex gap-1">
              {(canUndo || canRedo) && (
                <div className="flex rounded-md bg-card/90 backdrop-blur-sm border border-border shadow-sm overflow-hidden">
                  <button
                    onClick={undo}
                    disabled={!canUndo}
                    className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
                    title="undo (ctrl+z)"
                  >
                    ↶
                  </button>
                  <button
                    onClick={redo}
                    disabled={!canRedo}
                    className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30 border-l border-border"
                    title="redo (ctrl+shift+z)"
                  >
                    ↷
                  </button>
                </div>
              )}
              {hasManualPositions && (
                <button
                  onClick={resetLayout}
                  className="rounded-md bg-card/90 backdrop-blur-sm border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm"
                >
                  ↻ reset layout
                </button>
              )}
            </div>
          </div>
        </Panel>

        <style>{`
          .react-flow__node[data-id="${focusedNodeId}"] > div > div {
            box-shadow: 0 0 0 3px hsl(var(--ring, 215 20% 65%)), 0 0 12px hsl(var(--ring, 215 20% 65%) / 0.3);
          }
        `}</style>
      </ReactFlow>

      <PersonDetailPanel
        person={detailPersonId ? filteredNodes.find(n => n.id === detailPersonId) ?? treeNodes.find(n => n.id === detailPersonId) ?? null : null}
        allNodes={treeNodes}
        events={(events ?? []).filter(e => e.person_id === detailPersonId)}
        onClose={() => setDetailPersonId(null)}
        onNavigateTo={(id) => {
          setDetailPersonId(id);
          setFocusedNodeId(id);
        }}
      />

      {contextMenu && (
        <NodeContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          personId={contextMenu.personId}
          personName={treeNodes.find(n => n.id === contextMenu.personId)?.displayName ?? ""}
          hasChildren={(treeNodes.find(n => n.id === contextMenu.personId)?.childIds.length ?? 0) > 0}
          isCollapsed={collapsedIds.has(contextMenu.personId)}
          isCollapsible={collapsibleIds.has(contextMenu.personId)}
          onClose={() => setContextMenu(null)}
          onQuickAdd={() => {}}
          onViewDetails={() => {
            setDetailPersonId(contextMenu.personId);
            setContextMenu(null);
          }}
          onEdit={() => {
            router.push(`/person/${contextMenu.personId}/edit`);
            setContextMenu(null);
          }}
          onSetFocal={() => {
            setFocusedNodeId(contextMenu.personId);
            setContextMenu(null);
          }}
          onToggleCollapse={() => {
            toggleCollapse(contextMenu.personId);
            setContextMenu(null);
          }}
          onDelete={() => {
            handleDeletePerson(contextMenu.personId);
            setContextMenu(null);
          }}
        />
      )}
    </>
  );
}

export function HourglassChart({
  nodes,
  rootId,
  colorMode,
  events,
}: {
  nodes: TreeNode[];
  rootId: string;
  colorMode?: ColorMode;
  events?: PersonEvent[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.clientWidth > 0 && el.clientHeight > 0) { setReady(true); return; }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setReady(true); observer.disconnect(); break;
        }
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {ready ? (
        <ReactFlowProvider>
          <HourglassChartInner nodes={nodes} rootId={rootId} colorMode={colorMode} events={events} />
        </ReactFlowProvider>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">loading chart...</div>
      )}
    </div>
  );
}
