/**
 * tree-layout.ts
 *
 * Custom genealogy layout engine that handles converging family lines
 * (multiple families merging through marriage). Produces React Flow
 * nodes/edges. No React imports — only type imports from @xyflow/react.
 *
 * Layout strategy:
 *   1. Assign generations via BFS from roots
 *   2. Fixpoint loop: align spouses → push children below → close gaps
 *   3. Order nodes within each generation (couples adjacent, siblings grouped)
 *   4. Convert to pixel positions for React Flow
 */

import type { Node as RFNode, Edge as RFEdge } from "@xyflow/react";
import type { TreeNode, ColorMode, RelationshipType } from "./types";
import type { PersonNodeData } from "@/app/components/person-node";
import type { UnionNodeData } from "@/app/components/union-node";

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

const COL_WIDTH = 200; // pixels between columns
const ROW_HEIGHT = 160; // pixels between generation rows
const UNION_Y_OFFSET = 72; // union node sits this far below parent row
const UNION_WIDTH = 24;
const UNION_HEIGHT = 24;

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

export function hashSurname(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % 12;
}

export function computeCompleteness(n: TreeNode): number {
  let score = 0;
  if (n.birthYear) score++;
  if (n.deathYear || n.isLiving) score++;
  if (n.displayName && n.displayName !== "unknown") score++;
  if (n.thumbnailUrl) score++;
  return score;
}

/** edge style per parent relationship type */
function parentEdgeStyle(type: RelationshipType): Record<string, unknown> {
  switch (type) {
    case "biological_parent":
      return { strokeWidth: 2, stroke: "var(--color-border)" };
    case "adoptive_parent":
      return { strokeWidth: 1.5, stroke: "var(--color-border)", strokeDasharray: "8 4" };
    case "step_parent":
      return { strokeWidth: 1.5, stroke: "var(--color-border)", strokeDasharray: "2 3" };
    case "foster_parent":
      return { strokeWidth: 1, stroke: "var(--color-border)", strokeDasharray: "10 3 2 3" };
    case "guardian":
      return { strokeWidth: 1, stroke: "var(--color-border)", strokeDasharray: "4 6" };
    default:
      return { strokeWidth: 2, stroke: "var(--color-border)" };
  }
}

/** human-readable label for a parent relationship type */
function relTypeLabel(type: RelationshipType): string {
  switch (type) {
    case "biological_parent": return "biological";
    case "adoptive_parent": return "adoptive";
    case "step_parent": return "step";
    case "foster_parent": return "foster";
    case "guardian": return "guardian";
    default: return "biological";
  }
}

/** label text for non-biological parent→child edges (empty string for biological) */
function parentEdgeLabel(type: RelationshipType): string {
  switch (type) {
    case "adoptive_parent": return "adopted";
    case "step_parent": return "step";
    case "foster_parent": return "foster";
    case "guardian": return "guardian";
    default: return "";
  }
}

const parentLabelStyle = { fontSize: 9, fill: "var(--color-muted-foreground)", fontWeight: 500 };
const parentLabelBgStyle = { fill: "var(--color-background)", fillOpacity: 0.85 };
const parentLabelBgPadding: [number, number] = [3, 1];

// ---------------------------------------------------------------------------
// determineRootId
// ---------------------------------------------------------------------------

export function determineRootId(treeNodes: TreeNode[]): string {
  // prefer the person with no parents who has the most descendants
  const roots = treeNodes.filter((n) => n.parentIds.length === 0);
  if (roots.length === 0) return treeNodes[0]?.id ?? "";

  // count descendants for each root via BFS
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));
  let bestRoot = roots[0];
  let bestCount = 0;

  for (const root of roots) {
    const visited = new Set<string>();
    const queue = [root.id];
    while (queue.length > 0) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      const node = nodeMap.get(id);
      if (node) {
        for (const cid of node.childIds) queue.push(cid);
      }
    }
    if (visited.size > bestCount) {
      bestCount = visited.size;
      bestRoot = root;
    }
  }

  return bestRoot.id;
}

// ---------------------------------------------------------------------------
// findCoupleUnits
// ---------------------------------------------------------------------------

function findCoupleUnits(treeNodes: TreeNode[]) {
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));
  const coupleChildren = new Map<string, Set<string>>();
  const childHandledByCouple = new Map<string, string>();

  for (const child of treeNodes) {
    if (child.parentIds.length >= 2) {
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

// ---------------------------------------------------------------------------
// generation assignment — BFS + fixpoint alignment
// ---------------------------------------------------------------------------

function computeGenerations(treeNodes: TreeNode[]): Map<string, number> {
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));
  const generations = new Map<string, number>();

  // BFS from roots (people with no parents)
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

  // assign any unvisited nodes gen 0
  for (const n of treeNodes) {
    if (!generations.has(n.id)) generations.set(n.id, 0);
  }

  // fixpoint loop: align spouses, enforce children below parents, close gaps
  let changed = true;
  let iterations = 0;
  while (changed && iterations < 50) {
    changed = false;
    iterations++;

    // 1. spouses → same generation (take the max)
    for (const n of treeNodes) {
      for (const spouseId of n.spouseIds) {
        const g1 = generations.get(n.id)!;
        const g2 = generations.get(spouseId)!;
        if (g1 !== g2) {
          const mx = Math.max(g1, g2);
          generations.set(n.id, mx);
          generations.set(spouseId, mx);
          changed = true;
        }
      }
    }

    // 2. children must be strictly below all their parents
    for (const n of treeNodes) {
      const pg = generations.get(n.id)!;
      for (const childId of n.childIds) {
        if (generations.get(childId)! <= pg) {
          generations.set(childId, pg + 1);
          changed = true;
        }
      }
    }

    // 3. close gaps — push parents down to sit exactly 1 row above nearest child
    for (const n of treeNodes) {
      if (n.childIds.length > 0) {
        const myGen = generations.get(n.id)!;
        const minChildGen = Math.min(...n.childIds.map((id) => generations.get(id)!));
        if (minChildGen - myGen > 1) {
          generations.set(n.id, minChildGen - 1);
          changed = true;
        }
      }
    }
  }

  return generations;
}

// ---------------------------------------------------------------------------
// column ordering — couples adjacent, siblings grouped, parents centered
// ---------------------------------------------------------------------------

function computeColumns(
  treeNodes: TreeNode[],
  generations: Map<string, number>,
): Map<string, number> {
  const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));
  const columns = new Map<string, number>();

  // group nodes by generation
  const genGroups = new Map<number, string[]>();
  for (const n of treeNodes) {
    const gen = generations.get(n.id)!;
    const group = genGroups.get(gen) ?? [];
    group.push(n.id);
    genGroups.set(gen, group);
  }

  const sortedGens = [...genGroups.keys()].sort((a, b) => a - b);

  // for each generation, order nodes:
  // - keep couples adjacent
  // - keep siblings together
  // - order by parent column position (children under their parents)
  for (const gen of sortedGens) {
    const ids = genGroups.get(gen)!;

    // build ordering key for each node
    type OrderEntry = { id: string; parentCenter: number; coupleGroup: number; siblingGroup: string };
    const entries: OrderEntry[] = [];
    const processedCouples = new Set<string>();

    // compute parent center for ordering children under parents
    function getParentCenter(nodeId: string): number {
      const node = nodeMap.get(nodeId);
      if (!node || node.parentIds.length === 0) return 0;
      const parentCols = node.parentIds
        .map((pid) => columns.get(pid))
        .filter((c): c is number => c !== undefined);
      if (parentCols.length === 0) return 0;
      return parentCols.reduce((a, b) => a + b, 0) / parentCols.length;
    }

    // group siblings: key is sorted list of parent ids
    function siblingKey(nodeId: string): string {
      const node = nodeMap.get(nodeId);
      if (!node || node.parentIds.length === 0) return nodeId;
      return [...node.parentIds].sort().join(",");
    }

    // assign couple groups: spouses in same gen get same group
    let coupleGroupCounter = 0;
    const coupleGroupMap = new Map<string, number>();

    for (const id of ids) {
      if (coupleGroupMap.has(id)) continue;
      const node = nodeMap.get(id)!;
      const cg = coupleGroupCounter++;
      coupleGroupMap.set(id, cg);
      // find spouses in this same generation
      for (const sid of node.spouseIds) {
        if (generations.get(sid) === gen && !coupleGroupMap.has(sid)) {
          coupleGroupMap.set(sid, cg);
        }
      }
    }

    for (const id of ids) {
      entries.push({
        id,
        parentCenter: getParentCenter(id),
        coupleGroup: coupleGroupMap.get(id) ?? 0,
        siblingGroup: siblingKey(id),
      });
    }

    // sort by: parent center first, then couple group, then sibling group
    entries.sort((a, b) => {
      const pc = a.parentCenter - b.parentCenter;
      if (Math.abs(pc) > 0.001) return pc;
      const cg = a.coupleGroup - b.coupleGroup;
      if (cg !== 0) return cg;
      return a.siblingGroup.localeCompare(b.siblingGroup);
    });

    // assign columns
    for (let i = 0; i < entries.length; i++) {
      columns.set(entries[i].id, i);
    }
  }

  return columns;
}

// ---------------------------------------------------------------------------
// layoutPedigree — main layout function
// ---------------------------------------------------------------------------

export function layoutPedigree(
  treeNodes: TreeNode[],
  _rootId: string | undefined,
  colorMode: ColorMode,
): { nodes: RFNode[]; edges: RFEdge[] } {
  if (treeNodes.length === 0) return { nodes: [], edges: [] };

  // 1. compute generations and column positions
  const generations = computeGenerations(treeNodes);
  const columns = computeColumns(treeNodes, generations);

  // 2. build surname index map
  const uniqueSurnames = [...new Set(
    treeNodes.map((n) => n.surname).filter((s): s is string => !!s),
  )];
  const surnameIndexMap = new Map<string, number>();
  for (const s of uniqueSurnames) {
    surnameIndexMap.set(s, hashSurname(s));
  }

  // 3. find couple units for union junction nodes
  const { coupleChildren, childHandledByCouple, nodeMap } = findCoupleUnits(treeNodes);

  // 4. build position map
  const positionMap = new Map<string, { x: number; y: number; gen: number }>();
  for (const n of treeNodes) {
    const col = columns.get(n.id) ?? 0;
    const gen = generations.get(n.id) ?? 0;
    positionMap.set(n.id, {
      x: col * COL_WIDTH,
      y: gen * ROW_HEIGHT,
      gen,
    });
  }

  // ---------------------------------------------------------------------------
  // build React Flow nodes
  // ---------------------------------------------------------------------------

  const rfNodes: RFNode[] = [];
  const rfEdges: RFEdge[] = [];

  for (const n of treeNodes) {
    const pos = positionMap.get(n.id)!;
    rfNodes.push({
      id: n.id,
      type: "person",
      draggable: true,
      position: { x: pos.x, y: pos.y },
      data: {
        ...n,
        generation: pos.gen,
        colorMode,
        surnameIndex: n.surname ? (surnameIndexMap.get(n.surname) ?? -1) : -1,
        completenessScore: computeCompleteness(n),
      } satisfies PersonNodeData,
    });
  }

  // ---------------------------------------------------------------------------
  // union junction nodes + edges
  // ---------------------------------------------------------------------------

  const processedSpouseKeys = new Set<string>();
  const unionNodes: { id: string; key: string; p1: string; p2: string; relType: string; label: string }[] = [];

  for (const n of treeNodes) {
    for (let i = 0; i < n.spouseIds.length; i++) {
      const spouseId = n.spouseIds[i];
      const key = [n.id, spouseId].sort().join("--");
      if (processedSpouseKeys.has(key)) continue;
      processedSpouseKeys.add(key);

      const edgeMeta = n.spouseEdges[i];
      const relType = edgeMeta?.type ?? "spouse";
      const marriageYear = edgeMeta?.startDate ?? null;

      let symbol = "=";
      if (relType === "ex_spouse") symbol = "\u00F7";
      else if (relType === "partner") symbol = "\u2661";
      const label = marriageYear ? `${symbol} ${marriageYear}` : symbol;

      const hasSharedChildren = coupleChildren.has(key);

      if (hasSharedChildren) {
        unionNodes.push({ id: `union-${key}`, key, p1: key.split("--")[0], p2: key.split("--")[1], relType, label });
      } else {
        rfEdges.push({
          id: `spouse-${key}`,
          source: n.id,
          target: spouseId,
          type: "straight",
          style: {
            stroke: relType === "ex_spouse" ? "var(--color-muted-foreground)" : "var(--color-accent)",
            strokeWidth: 2,
            strokeDasharray: relType === "ex_spouse" ? "6 3" : undefined,
          },
          label,
          labelStyle: { fontSize: 11, fill: "var(--color-muted-foreground)", fontWeight: 500 },
          labelBgStyle: { fill: "var(--color-background)", fillOpacity: 0.85 },
          labelBgPadding: [4, 2] as [number, number],
          data: { relType, tooltip: marriageYear ? `married ${marriageYear}` : relType },
        });
      }
    }
  }

  // co-parents not listed as spouses
  for (const [key, _children] of coupleChildren) {
    if (processedSpouseKeys.has(key)) continue;
    const [p1, p2] = key.split("--");
    unionNodes.push({ id: `union-${key}`, key, p1, p2, relType: "biological_parent", label: "" });
  }

  // position union nodes and create edges
  for (const union of unionNodes) {
    const pos1 = positionMap.get(union.p1);
    const pos2 = positionMap.get(union.p2);
    if (!pos1 || !pos2) continue;

    const midX = (pos1.x + pos2.x) / 2;
    const parentY = Math.max(pos1.y, pos2.y);

    rfNodes.push({
      id: union.id,
      type: "union",
      draggable: true,
      position: {
        x: midX + (COL_WIDTH / 2) - (UNION_WIDTH / 2),
        y: parentY + UNION_Y_OFFSET - (UNION_HEIGHT / 2),
      },
      data: {
        relType: union.relType,
        label: union.label,
      } satisfies UnionNodeData,
    });

    // parent1 → union
    rfEdges.push({
      id: `${union.p1}->${union.id}`,
      source: union.p1,
      target: union.id,
      type: "straight",
      style: {
        stroke: union.relType === "ex_spouse" ? "var(--color-muted-foreground)" : "var(--color-accent)",
        strokeWidth: 2,
        strokeDasharray: union.relType === "ex_spouse" ? "6 3" : undefined,
      },
      data: { relType: union.relType, tooltip: union.relType },
    });

    // parent2 → union
    rfEdges.push({
      id: `${union.p2}->${union.id}`,
      source: union.p2,
      target: union.id,
      type: "straight",
      style: {
        stroke: union.relType === "ex_spouse" ? "var(--color-muted-foreground)" : "var(--color-accent)",
        strokeWidth: 2,
        strokeDasharray: union.relType === "ex_spouse" ? "6 3" : undefined,
      },
      data: { relType: union.relType, tooltip: union.relType },
    });

    // union → shared children
    const children = coupleChildren.get(union.key)!;
    for (const childId of children) {
      const child = nodeMap.get(childId);
      let relType: RelationshipType = "biological_parent";
      if (child) {
        for (let i = 0; i < child.parentIds.length; i++) {
          if (child.parentIds[i] === union.p1 || child.parentIds[i] === union.p2) {
            relType = child.parentEdges[i]?.type ?? "biological_parent";
            break;
          }
        }
      }

      const edgeLabel = parentEdgeLabel(relType);
      rfEdges.push({
        id: `${union.id}->${childId}`,
        source: union.id,
        target: childId,
        type: "smart",
        style: parentEdgeStyle(relType),
        ...(edgeLabel ? {
          label: edgeLabel,
          labelStyle: parentLabelStyle,
          labelBgStyle: parentLabelBgStyle,
          labelBgPadding: parentLabelBgPadding,
        } : {}),
        data: { relType, tooltip: `${relTypeLabel(relType)} relationship` },
      });
    }
  }

  // ---------------------------------------------------------------------------
  // direct parent→child edges for single-parent children
  // ---------------------------------------------------------------------------

  for (const n of treeNodes) {
    if (childHandledByCouple.has(n.id)) continue;

    for (let i = 0; i < n.parentIds.length; i++) {
      const parentId = n.parentIds[i];
      const edgeMeta = n.parentEdges[i];
      const relType = edgeMeta?.type ?? "biological_parent";

      const edgeLabel = parentEdgeLabel(relType);
      rfEdges.push({
        id: `${parentId}->${n.id}`,
        source: parentId,
        target: n.id,
        type: "smart",
        style: parentEdgeStyle(relType),
        ...(edgeLabel ? {
          label: edgeLabel,
          labelStyle: parentLabelStyle,
          labelBgStyle: parentLabelBgStyle,
          labelBgPadding: parentLabelBgPadding,
        } : {}),
        data: { relType, tooltip: `${relTypeLabel(relType)} relationship` },
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}
