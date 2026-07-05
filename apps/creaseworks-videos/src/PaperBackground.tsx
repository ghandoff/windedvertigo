// Reusable graph-paper-on-parchment background for all creaseworks video compositions.
// Matches the aesthetic direction confirmed 2026-07-05.
import React from "react";

export const PAPER_BG = "#f5f0e8";
export const GRID_COLOR = "#ddd5c8";
export const INK_WARM = "#2a2318";
export const SAGE = "#6b8c6b";
export const TERRACOTTA = "#b5654a";
export const DUSTY_TEAL = "#4a8080";
export const ROSY = "#e8a090";

type PaperBackgroundProps = {
  width?: number;
  height?: number;
  gridSpacing?: number;
  gridOpacity?: number;
};

export const PaperBackground: React.FC<PaperBackgroundProps> = ({
  width = 1920,
  height = 1080,
  gridSpacing = 44,
  gridOpacity = 1,
}) => {
  const cols = Math.ceil(width / gridSpacing) + 1;
  const rows = Math.ceil(height / gridSpacing) + 1;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      style={{ position: "absolute", top: 0, left: 0 }}
    >
      {/* parchment base */}
      <rect width={width} height={height} fill={PAPER_BG} />

      {/* grid lines */}
      <g stroke={GRID_COLOR} strokeWidth={0.8} opacity={gridOpacity}>
        {/* vertical */}
        {Array.from({ length: cols }).map((_, i) => (
          <line key={`v${i}`} x1={i * gridSpacing} y1={0} x2={i * gridSpacing} y2={height} />
        ))}
        {/* horizontal */}
        {Array.from({ length: rows }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * gridSpacing} x2={width} y2={i * gridSpacing} />
        ))}
      </g>
    </svg>
  );
};
