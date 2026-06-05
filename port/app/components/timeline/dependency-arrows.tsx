"use client";

import type { TimelineBar } from "./timeline-types";

export interface BarRect {
  x: number; // left px (start)
  w: number; // width px
  y: number; // top px
  h: number; // height px
}

// SVG overlay drawing dependency connectors from each predecessor's end edge to
// its successor's start edge. Endpoints come from the same layout rects the
// engine computes — no DOM measurement. A connector turns red when the
// predecessor finishes after the successor starts (a scheduling conflict).
export function DependencyArrows({
  bars,
  rects,
  width,
  height,
  hoveredId,
  showAll,
}: {
  bars: TimelineBar[];
  rects: Map<string, BarRect>;
  width: number;
  height: number;
  hoveredId: string | null;
  showAll: boolean;
}) {
  const lines: React.ReactNode[] = [];

  for (const bar of bars) {
    if (!bar.dependsOn?.length) continue;
    const target = rects.get(bar.id);
    if (!target) continue;

    for (const depId of bar.dependsOn) {
      const source = rects.get(depId);
      if (!source) continue;

      const visible = showAll || hoveredId === bar.id || hoveredId === depId;
      if (!visible) continue;

      const x1 = source.x + source.w; // predecessor end
      const y1 = source.y + source.h / 2;
      const x2 = target.x; // successor start
      const y2 = target.y + target.h / 2;
      const conflict = x1 > x2 + 1;

      // cubic bézier with horizontal control handles for a clean S-curve
      const dx = Math.max(20, Math.abs(x2 - x1) / 2);
      const path = `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`;
      const stroke = conflict ? "#b15043" : "#8a93a6";

      lines.push(
        <g key={`${depId}->${bar.id}`}>
          <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} opacity={0.85} />
          <circle cx={x1} cy={y1} r={2.5} fill={stroke} />
          <path
            d={`M ${x2} ${y2} l -5 -3 l 0 6 z`}
            fill={stroke}
          />
        </g>,
      );
    }
  }

  if (lines.length === 0) return null;

  return (
    <svg
      className="absolute top-0 left-0 pointer-events-none"
      width={width}
      height={height}
      style={{ zIndex: 5 }}
    >
      {lines}
    </svg>
  );
}
