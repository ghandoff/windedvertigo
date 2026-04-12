"use client";

import { useState, useCallback, useMemo } from "react";
import type { TreeNode } from "@/lib/types";

/**
 * Filters out descendant subtrees of collapsed nodes.
 * Returns the visible subset of treeNodes with trimmed refs,
 * plus metadata for each node about collapsibility.
 */
export function useCollapse(treeNodes: TreeNode[]) {
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((nodeId: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  }, []);

  // compute which nodes are hidden (descendants of collapsed nodes)
  const { visibleNodes, collapsibleIds } = useMemo(() => {
    const nodeMap = new Map(treeNodes.map((n) => [n.id, n]));

    // nodes with children are collapsible
    const collapsible = new Set<string>();
    for (const n of treeNodes) {
      if (n.childIds.length > 0) collapsible.add(n.id);
    }

    // BFS from each collapsed node to find all hidden descendants
    const hidden = new Set<string>();
    for (const collapsedId of collapsedIds) {
      const queue = [...(nodeMap.get(collapsedId)?.childIds ?? [])];
      while (queue.length > 0) {
        const id = queue.shift()!;
        if (hidden.has(id)) continue;
        hidden.add(id);
        const node = nodeMap.get(id);
        if (node) {
          for (const cid of node.childIds) queue.push(cid);
        }
      }
    }

    // filter to visible nodes, trim refs
    const visibleSet = new Set(treeNodes.filter((n) => !hidden.has(n.id)).map((n) => n.id));
    const visible = treeNodes
      .filter((n) => visibleSet.has(n.id))
      .map((n) => ({
        ...n,
        parentIds: n.parentIds.filter((id) => visibleSet.has(id)),
        childIds: n.childIds.filter((id) => visibleSet.has(id)),
        spouseIds: n.spouseIds.filter((id) => visibleSet.has(id)),
        parentEdges: n.parentEdges.filter((_, i) => visibleSet.has(n.parentIds[i])),
        spouseEdges: n.spouseEdges.filter((_, i) => visibleSet.has(n.spouseIds[i])),
      }));

    return { visibleNodes: visible, collapsibleIds: collapsible };
  }, [treeNodes, collapsedIds]);

  return { visibleNodes, collapsedIds, collapsibleIds, toggleCollapse };
}
