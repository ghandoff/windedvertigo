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
import type { LayoutPositions } from "@/lib/db/queries";
import { layoutPedigree, determineRootId } from "@/lib/tree-layout";
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

const nodeTypes = { person: PersonNode, union: UnionNode };
const edgeTypes = { smart: SmartStepEdge };

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

// ---------------------------------------------------------------------------
// debounced position saver — batches drag events into a single API call
// ---------------------------------------------------------------------------

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let pendingPositions: LayoutPositions = {};

function debouncedSavePositions(positions: LayoutPositions) {
  pendingPositions = { ...pendingPositions, ...positions };
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const toSave = pendingPositions;
    pendingPositions = {};
    fetch("/api/layout", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positions: toSave }),
    }).catch(() => {
      // silently fail — positions will be recalculated on next load
    });
  }, 800);
}

function PedigreeChartInner({
  nodes: treeNodes,
  colorMode = "sex",
  rootId,
  savedPositions = {},
  events = [],
}: {
  nodes: TreeNode[];
  colorMode?: ColorMode;
  rootId?: string;
  savedPositions?: LayoutPositions;
  events?: PersonEvent[];
}) {
  const router = useRouter();
  const { setCenter, getNodes, fitView } = useReactFlow();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [hasManualPositions, setHasManualPositions] = useState(
    Object.keys(savedPositions).length > 0,
  );
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ personId: string; x: number; y: number } | null>(null);
  const [helperLines, setHelperLines] = useState<HelperLinePosition>({});
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [resetMenuOpen, setResetMenuOpen] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState("");
  const resetMenuRef = useRef<HTMLDivElement>(null);
  const { visibleNodes, collapsedIds, collapsibleIds, toggleCollapse } = useCollapse(treeNodes);
  const { canUndo, canRedo, takeSnapshot, undo, redo } = useUndoRedo();

  const effectiveRootId = rootId ?? determineRootId(treeNodes);

  // compute auto-layout, then overlay any saved positions
  const { nodes: layoutNodes, edges: layoutEdges } = useMemo(() => {
    const result = layoutPedigree(visibleNodes, effectiveRootId, colorMode);

    // apply persisted positions over auto-layout
    if (Object.keys(savedPositions).length > 0) {
      for (const node of result.nodes) {
        const saved = savedPositions[node.id];
        if (saved) {
          node.position = { x: saved.x, y: saved.y };
        }
      }
    }

    return result;
  }, [visibleNodes, effectiveRootId, colorMode, savedPositions]);

  // apply focused styling + collapse metadata
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

  // sync layout when treeNodes or colorMode changes
  useEffect(() => {
    setNodes(styledNodes);
    setEdges(layoutEdges);
  }, [styledNodes, layoutEdges, setNodes, setEdges]);

  // initial fit (container is guaranteed to have dimensions by outer wrapper)
  useEffect(() => {
    if (treeNodes.length > 0) {
      const timer = setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
      return () => clearTimeout(timer);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const treeNodeMap = useMemo(
    () => new Map(treeNodes.map((n) => [n.id, n])),
    [treeNodes],
  );

  /** handle node drag — helper line snapping + persist positions on drag end */
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      // detect drag-end events to persist positions + take undo snapshot
      const dragEndChanges = changes.filter(
        (c) =>
          c.type === "position" &&
          !(c as { dragging?: boolean }).dragging &&
          (c as { position?: { x: number; y: number } }).position,
      );

      if (dragEndChanges.length > 0) {
        setHasManualPositions(true);
        setHelperLines({}); // clear helper lines on drag end
        takeSnapshot(); // capture for undo

        const positions: LayoutPositions = {};
        for (const change of dragEndChanges) {
          const pos = (change as { id: string; position: { x: number; y: number } }).position;
          const id = (change as { id: string }).id;
          if (pos) {
            positions[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
          }
        }
        if (Object.keys(positions).length > 0) {
          debouncedSavePositions(positions);
        }
      }

      // detect active dragging — apply helper line snapping
      const activeDrags = changes.filter(
        (c) => c.type === "position" && (c as { dragging?: boolean }).dragging && (c as { position?: { x: number; y: number } }).position,
      );

      if (activeDrags.length > 0) {
        setHasManualPositions(true);

        // apply helper line snapping to the first dragged node
        const drag = activeDrags[0] as { id: string; position: { x: number; y: number } };
        const currentNodes = getNodes();
        const result = getHelperLines(
          { id: drag.id, position: drag.position },
          currentNodes,
          selectedNodeIds,
        );
        setHelperLines({ horizontal: result.horizontal, vertical: result.vertical, isSelectionSnap: result.isSelectionSnap });

        // snap the position
        if (result.horizontal !== undefined || result.vertical !== undefined) {
          drag.position = result.snapPosition;
        }
      } else if (dragEndChanges.length === 0) {
        // no drag activity — clear helper lines
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

  /** apply fresh auto-layout to the canvas (no DB changes) */
  const applyFreshLayout = useCallback(() => {
    const { nodes: fresh, edges: freshEdges } = layoutPedigree(visibleNodes, effectiveRootId, colorMode);
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
  }, [visibleNodes, effectiveRootId, colorMode, focusedNodeId, collapsibleIds, collapsedIds, toggleCollapse, setNodes, setEdges, fitView]);

  /** reset my view only — auto-layout for this session, DB untouched */
  const resetMyView = useCallback(() => {
    applyFreshLayout();
    setResetMenuOpen(false);
  }, [applyFreshLayout]);

  /** reset for everyone — auto-layout + delete saved positions from DB */
  const resetForEveryone = useCallback(() => {
    applyFreshLayout();
    fetch("/api/layout", { method: "DELETE" }).catch(() => {});
    setResetConfirmOpen(false);
    setResetConfirmText("");
    setResetMenuOpen(false);
  }, [applyFreshLayout]);

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
      // persist aligned positions
      const layoutPositions: LayoutPositions = {};
      for (const [id, pos] of Object.entries(positions)) {
        layoutPositions[id] = { x: Math.round(pos.x), y: Math.round(pos.y) };
      }
      debouncedSavePositions(layoutPositions);
    },
    [setNodes, takeSnapshot],
  );

  const handleDeletePerson = useCallback(async (personId: string) => {
    try {
      await fetch(`/api/person/${personId}`, { method: "DELETE" });
      window.location.reload();
    } catch {}
  }, []);

  // close reset menu on click outside
  useEffect(() => {
    if (!resetMenuOpen) return;
    function handleClick(e: MouseEvent) {
      if (resetMenuRef.current && !resetMenuRef.current.contains(e.target as HTMLElement)) {
        setResetMenuOpen(false);
        setResetConfirmOpen(false);
        setResetConfirmText("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [resetMenuOpen]);

  // keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
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
        <MiniMap
          nodeStrokeWidth={3}
          zoomable
          pannable
          position="bottom-left"
          className="!bg-background/80 !border-border"
        />
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--color-border)" />

        {/* alignment helper lines */}
        <HelperLinesRenderer horizontal={helperLines.horizontal} vertical={helperLines.vertical} isSelectionSnap={helperLines.isSelectionSnap} />

        {/* alignment toolbar for multi-select */}
        {selectedNodeIds.length >= 2 && (
          <Panel position="top-right" className="!mr-2 !mt-14">
            <AlignmentToolbar selectedNodeIds={selectedNodeIds} onAlign={handleAlign} />
          </Panel>
        )}

        {/* undo/redo + reset layout controls */}
        <Panel position="top-left" className="!ml-2 !mt-14">
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
              <div ref={resetMenuRef} className="relative">
                <button
                  onClick={() => {
                    setResetMenuOpen((v) => !v);
                    setResetConfirmOpen(false);
                    setResetConfirmText("");
                  }}
                  className="rounded-md bg-card/90 backdrop-blur-sm border border-border px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shadow-sm flex items-center gap-1"
                  title="reset layout options"
                >
                  ↻ reset layout
                  <svg width="8" height="8" viewBox="0 0 8 8" className={`transition-transform ${resetMenuOpen ? "rotate-180" : ""}`}>
                    <path d="M1 3l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>

                {resetMenuOpen && (
                  <div className="absolute top-full left-0 mt-1 w-64 rounded-md bg-card border border-border shadow-lg z-50 overflow-hidden">
                    {!resetConfirmOpen ? (
                      <>
                        <button
                          onClick={resetMyView}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border"
                        >
                          <div className="text-xs font-medium text-foreground">reset my view</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            auto-layout for this session only — saved positions stay in the database
                          </div>
                        </button>
                        <button
                          onClick={() => setResetConfirmOpen(true)}
                          className="w-full text-left px-3 py-2.5 hover:bg-destructive/10 transition-colors"
                        >
                          <div className="text-xs font-medium text-destructive">reset for everyone</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            permanently erase saved positions for all collaborators
                          </div>
                        </button>
                      </>
                    ) : (
                      <div className="p-3 space-y-2">
                        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                          <span>⚠</span> this cannot be undone
                        </div>
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          this will erase all saved node positions for every collaborator on this tree.
                        </p>
                        <label className="block">
                          <span className="text-[10px] text-muted-foreground">
                            type <span className="font-mono font-bold text-foreground">reset</span> to confirm
                          </span>
                          <input
                            type="text"
                            value={resetConfirmText}
                            onChange={(e) => setResetConfirmText(e.target.value)}
                            placeholder="reset"
                            className="mt-1 w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring"
                            autoFocus
                          />
                        </label>
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setResetConfirmOpen(false);
                              setResetConfirmText("");
                            }}
                            className="flex-1 rounded border border-border px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          >
                            cancel
                          </button>
                          <button
                            onClick={resetForEveryone}
                            disabled={resetConfirmText.toLowerCase() !== "reset"}
                            className="flex-1 rounded bg-destructive px-2 py-1 text-xs text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            confirm reset
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </Panel>

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

        {/* focused node highlight overlay */}
        <style>{`
          .react-flow__node[data-id="${focusedNodeId}"] > div > div {
            box-shadow: 0 0 0 3px hsl(var(--ring, 215 20% 65%)), 0 0 12px hsl(var(--ring, 215 20% 65%) / 0.3);
          }
        `}</style>
      </ReactFlow>

      {/* detail panel */}
      <PersonDetailPanel
        person={detailPersonId ? treeNodes.find(n => n.id === detailPersonId) ?? null : null}
        allNodes={treeNodes}
        events={events.filter(e => e.person_id === detailPersonId)}
        onClose={() => setDetailPersonId(null)}
        onNavigateTo={(id) => {
          setDetailPersonId(id);
          setFocusedNodeId(id);
          panToNode(id);
        }}
      />

      {/* context menu */}
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
          onQuickAdd={(type) => {
            // close context menu, the quick-add is handled by the node itself
            setContextMenu(null);
          }}
          onViewDetails={() => {
            setDetailPersonId(contextMenu.personId);
            setContextMenu(null);
          }}
          onEdit={() => {
            router.push(`/person/${contextMenu.personId}`);
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

/**
 * Wrapper that defers React Flow rendering until the container has non-zero
 * dimensions. This prevents the React Flow measurement bug caused by Next.js
 * Suspense/streaming: the loading skeleton can occupy the viewport and give
 * this container 0×0 at mount time, permanently breaking node visibility.
 */
export function PedigreeChart({
  nodes,
  colorMode,
  rootId,
  savedPositions,
  events,
}: {
  nodes: TreeNode[];
  colorMode?: ColorMode;
  rootId?: string;
  savedPositions?: LayoutPositions;
  events?: PersonEvent[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // already sized — render immediately
    if (el.clientWidth > 0 && el.clientHeight > 0) {
      setReady(true);
      return;
    }

    // wait for container to gain dimensions
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0 && entry.contentRect.height > 0) {
          setReady(true);
          observer.disconnect();
          break;
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
          <PedigreeChartInner nodes={nodes} colorMode={colorMode} rootId={rootId} savedPositions={savedPositions} events={events} />
        </ReactFlowProvider>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-muted-foreground text-sm">
          loading chart...
        </div>
      )}
    </div>
  );
}
