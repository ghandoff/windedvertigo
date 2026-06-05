"use client";

import { useState } from "react";
import type { TimelineBar } from "./timeline-types";

export interface BarRect {
  x: number; // left px (start)
  w: number; // width px
  y: number; // top px
  h: number; // height px
}

export interface LinkDrag {
  sourceId: string;
  dx: number;
  dy: number;
}

// SVG overlay: draws dependency connectors (predecessor end → successor start),
// the in-progress "ghost" line while drawing a new link, and — when editable —
// a click target with an ✕ to delete a link. Endpoints come from the layout
// rects (no DOM measurement → SSR-safe).
export function DependencyArrows({
  bars,
  rects,
  width,
  height,
  hoveredId,
  showAll,
  linkDrag,
  onLinkDelete,
}: {
  bars: TimelineBar[];
  rects: Map<string, BarRect>;
  width: number;
  height: number;
  hoveredId: string | null;
  showAll: boolean;
  linkDrag?: LinkDrag | null;
  onLinkDelete?: (predecessorId: string, successorId: string) => void;
}) {
  const [hoverEdge, setHoverEdge] = useState<string | null>(null);
  const elems: React.ReactNode[] = [];

  for (const bar of bars) {
    if (!bar.dependsOn?.length) continue;
    const target = rects.get(bar.id);
    if (!target) continue;

    for (const depId of bar.dependsOn) {
      const source = rects.get(depId);
      if (!source) continue;

      const visible = showAll || hoveredId === bar.id || hoveredId === depId;
      if (!visible) continue;

      const x1 = source.x + source.w;
      const y1 = source.y + source.h / 2;
      const x2 = target.x;
      const y2 = target.y + target.h / 2;
      const conflict = x1 > x2 + 1;
      const dx = Math.max(20, Math.abs(x2 - x1) / 2);
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      const stroke = conflict ? "#b15043" : "#8a93a6";
      const edgeKey = `${depId}->${bar.id}`;
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;

      elems.push(
        <g key={edgeKey}>
          <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.85} />
          <circle cx={x1} cy={y1} r={2.5} fill={stroke} />
          <path d={`M ${x2} ${y2} l -5 -3 l 0 6 z`} fill={stroke} />
          {onLinkDelete && (
            <g
              style={{ pointerEvents: "auto", cursor: "pointer" }}
              onMouseEnter={() => setHoverEdge(edgeKey)}
              onMouseLeave={() => setHoverEdge((k) => (k === edgeKey ? null : k))}
              onClick={() => onLinkDelete(depId, bar.id)}
            >
              {/* invisible wide hit area along the curve */}
              <path d={path} fill="none" stroke="transparent" strokeWidth={10} />
              {hoverEdge === edgeKey && (
                <>
                  <circle cx={mx} cy={my} r={7} fill="#b15043" />
                  <path
                    d={`M ${mx - 3} ${my - 3} L ${mx + 3} ${my + 3} M ${mx + 3} ${my - 3} L ${mx - 3} ${my + 3}`}
                    stroke="white"
                    strokeWidth={1.4}
                  />
                </>
              )}
            </g>
          )}
        </g>,
      );
    }
  }

  // ghost line while drawing a new dependency
  if (linkDrag) {
    const src = rects.get(linkDrag.sourceId);
    if (src) {
      const x1 = src.x + src.w;
      const y1 = src.y + src.h / 2;
      const x2 = x1 + linkDrag.dx;
      const y2 = y1 + linkDrag.dy;
      elems.push(
        <g key="__ghost__">
          <path d={`M ${x1} ${y1} L ${x2} ${y2}`} stroke="#5872cb" strokeWidth={1.75} strokeDasharray="4 3" />
          <circle cx={x2} cy={y2} r={3} fill="#5872cb" />
        </g>,
      );
    }
  }

  if (elems.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0"
      width={width}
      height={height}
      style={{ zIndex: 5, pointerEvents: "none" }}
    >
      {elems}
    </svg>
  );
}
