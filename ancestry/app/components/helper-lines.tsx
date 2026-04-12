"use client";

import { useStore } from "@xyflow/react";
import type { Node, XYPosition } from "@xyflow/react";

const SNAP_THRESHOLD = 5;
const DEFAULT_W = 160;
const DEFAULT_H = 60;

export type HelperLinePosition = {
  horizontal?: number;
  vertical?: number;
  /** true when the snap was against a selection bounding box (rendered differently) */
  isSelectionSnap?: { horizontal?: boolean; vertical?: boolean };
};

/** detect alignment between a dragged node and all other nodes + selection bounds */
export function getHelperLines(
  change: { id: string; position: XYPosition },
  nodes: Node[],
  selectedNodeIds?: string[],
): HelperLinePosition & { snapPosition: XYPosition } {
  const result: HelperLinePosition & { snapPosition: XYPosition } = {
    snapPosition: { ...change.position },
    isSelectionSnap: {},
  };

  const w = DEFAULT_W;
  const h = DEFAULT_H;
  const cx = change.position.x + w / 2;
  const cy = change.position.y + h / 2;
  const r = change.position.x + w;
  const b = change.position.y + h;

  let bestDx = SNAP_THRESHOLD;
  let bestDy = SNAP_THRESHOLD;

  // --- snap against individual nodes ---
  for (const node of nodes) {
    if (node.id === change.id) continue;
    const nw = node.measured?.width ?? (node.width as number | undefined) ?? DEFAULT_W;
    const nh = node.measured?.height ?? (node.height as number | undefined) ?? DEFAULT_H;
    const ncx = node.position.x + nw / 2;
    const ncy = node.position.y + nh / 2;
    const nr = node.position.x + nw;
    const nb = node.position.y + nh;

    // vertical guides (x alignment)
    const checks_x: [number, number, number][] = [
      [change.position.x, node.position.x, node.position.x],          // left-left
      [cx, ncx, ncx - w / 2],                                          // center-center
      [r, nr, nr - w],                                                  // right-right
      [change.position.x, nr, nr],                                     // left-right
      [r, node.position.x, node.position.x - w],                       // right-left
    ];
    for (const [dragged, target, snap] of checks_x) {
      const d = Math.abs(dragged - target);
      if (d < bestDx) {
        bestDx = d;
        result.vertical = target;
        result.snapPosition.x = snap;
        result.isSelectionSnap!.vertical = false;
      }
    }

    // horizontal guides (y alignment)
    const checks_y: [number, number, number][] = [
      [change.position.y, node.position.y, node.position.y],          // top-top
      [cy, ncy, ncy - h / 2],                                          // center-center
      [b, nb, nb - h],                                                  // bottom-bottom
      [change.position.y, nb, nb],                                     // top-bottom
      [b, node.position.y, node.position.y - h],                       // bottom-top
    ];
    for (const [dragged, target, snap] of checks_y) {
      const d = Math.abs(dragged - target);
      if (d < bestDy) {
        bestDy = d;
        result.horizontal = target;
        result.snapPosition.y = snap;
        result.isSelectionSnap!.horizontal = false;
      }
    }
  }

  // --- snap against selection bounding box ---
  const selectedIds = selectedNodeIds ?? [];
  // only compute if there are 2+ selected nodes and the dragged node is NOT in the selection
  if (selectedIds.length >= 2 && !selectedIds.includes(change.id)) {
    const selectedNodes = nodes.filter((n) => selectedIds.includes(n.id));
    if (selectedNodes.length >= 2) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const sn of selectedNodes) {
        const sw = sn.measured?.width ?? (sn.width as number | undefined) ?? DEFAULT_W;
        const sh = sn.measured?.height ?? (sn.height as number | undefined) ?? DEFAULT_H;
        minX = Math.min(minX, sn.position.x);
        minY = Math.min(minY, sn.position.y);
        maxX = Math.max(maxX, sn.position.x + sw);
        maxY = Math.max(maxY, sn.position.y + sh);
      }

      const selCx = (minX + maxX) / 2;
      const selCy = (minY + maxY) / 2;

      // vertical guides (x alignment) against selection bounds
      const sel_checks_x: [number, number, number][] = [
        [change.position.x, minX, minX],             // left edge → selection left
        [cx, selCx, selCx - w / 2],                   // center → selection center
        [r, maxX, maxX - w],                           // right edge → selection right
      ];
      for (const [dragged, target, snap] of sel_checks_x) {
        const d = Math.abs(dragged - target);
        if (d < bestDx) {
          bestDx = d;
          result.vertical = target;
          result.snapPosition.x = snap;
          result.isSelectionSnap!.vertical = true;
        }
      }

      // horizontal guides (y alignment) against selection bounds
      const sel_checks_y: [number, number, number][] = [
        [change.position.y, minY, minY],             // top edge → selection top
        [cy, selCy, selCy - h / 2],                   // center → selection center
        [b, maxY, maxY - h],                           // bottom edge → selection bottom
      ];
      for (const [dragged, target, snap] of sel_checks_y) {
        const d = Math.abs(dragged - target);
        if (d < bestDy) {
          bestDy = d;
          result.horizontal = target;
          result.snapPosition.y = snap;
          result.isSelectionSnap!.horizontal = true;
        }
      }
    }
  }

  return result;
}

const NODE_COLOR = "hsl(215, 70%, 55%)";
const SELECTION_COLOR = "hsl(300, 70%, 55%)";

/** renders alignment guide lines in flow-space, transformed to screen coords */
export function HelperLinesRenderer({
  horizontal,
  vertical,
  isSelectionSnap,
}: HelperLinePosition) {
  const transform = useStore((s) => s.transform);

  if (horizontal === undefined && vertical === undefined) return null;

  const [tx, ty, zoom] = transform;
  const vColor = isSelectionSnap?.vertical ? SELECTION_COLOR : NODE_COLOR;
  const hColor = isSelectionSnap?.horizontal ? SELECTION_COLOR : NODE_COLOR;

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-[5] overflow-visible"
      style={{ width: "100%", height: "100%" }}
    >
      {vertical !== undefined && (
        <line
          x1={vertical * zoom + tx}
          x2={vertical * zoom + tx}
          y1="0"
          y2="100%"
          stroke={vColor}
          strokeWidth={1}
          strokeDasharray="6 3"
          opacity={0.6}
        />
      )}
      {horizontal !== undefined && (
        <line
          x1="0"
          x2="100%"
          y1={horizontal * zoom + ty}
          y2={horizontal * zoom + ty}
          stroke={hColor}
          strokeWidth={1}
          strokeDasharray="6 3"
          opacity={0.6}
        />
      )}
    </svg>
  );
}
