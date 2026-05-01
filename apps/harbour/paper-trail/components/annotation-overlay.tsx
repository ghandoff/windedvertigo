"use client";

/**
 * paper.trail — annotation overlay
 *
 * SVG overlay on top of a captured image. Supports stamps
 * (emoji), arrows, and text labels. Click to place.
 */

import { useState, useCallback } from "react";
import type { Annotation, StampAnnotation, TextAnnotation } from "@/lib/types";

type Tool = "stamp" | "text" | "arrow" | null;

const STAMPS = ["⭐", "❓", "💡", "🔍", "✅", "❌", "🎯", "🔗"];

export function AnnotationOverlay({
  width,
  height,
  annotations,
  onAdd,
  onRemove,
}: {
  width: number;
  height: number;
  annotations: Annotation[];
  onAdd: (annotation: Annotation) => void;
  onRemove: (id: string) => void;
}) {
  const [activeTool, setActiveTool] = useState<Tool>(null);
  const [activeStamp, setActiveStamp] = useState(STAMPS[0]);

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!activeTool) return;

      const svg = e.currentTarget;
      const rect = svg.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * width;
      const y = ((e.clientY - rect.top) / rect.height) * height;
      const id = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

      if (activeTool === "stamp") {
        const stamp: StampAnnotation = {
          id,
          type: "stamp",
          x,
          y,
          emoji: activeStamp,
          size: 32,
        };
        onAdd(stamp);
      } else if (activeTool === "text") {
        const text = prompt("enter label text:");
        if (!text) return;
        const label: TextAnnotation = {
          id,
          type: "text",
          x,
          y,
          content: text,
          color: "#ffffff",
          fontSize: 16,
        };
        onAdd(label);
      }
    },
    [activeTool, activeStamp, width, height, onAdd],
  );

  return (
    <div className="relative">
      {/* Toolbar */}
      <div className="absolute top-2 left-2 z-10 flex gap-1.5 bg-black/60 rounded-lg p-1.5">
        <button
          onClick={() => setActiveTool(activeTool === "stamp" ? null : "stamp")}
          className={`px-2 py-1 rounded text-xs ${activeTool === "stamp" ? "bg-[var(--wv-redwood)] text-white" : "text-white/70 hover:text-white"}`}
          aria-label="stamp tool"
        >
          {activeStamp}
        </button>
        <button
          onClick={() => setActiveTool(activeTool === "text" ? null : "text")}
          className={`px-2 py-1 rounded text-xs ${activeTool === "text" ? "bg-[var(--wv-redwood)] text-white" : "text-white/70 hover:text-white"}`}
          aria-label="text tool"
        >
          Aa
        </button>
        {annotations.length > 0 && (
          <button
            onClick={() => {
              const last = annotations[annotations.length - 1];
              if (last) onRemove(last.id);
            }}
            className="px-2 py-1 rounded text-xs text-white/70 hover:text-white"
            aria-label="undo last annotation"
          >
            ↩
          </button>
        )}
      </div>

      {/* Stamp picker (visible when stamp tool active) */}
      {activeTool === "stamp" && (
        <div className="absolute top-12 left-2 z-10 flex gap-1 bg-black/60 rounded-lg p-1.5">
          {STAMPS.map((s) => (
            <button
              key={s}
              onClick={() => setActiveStamp(s)}
              className={`w-8 h-8 rounded flex items-center justify-center text-lg ${s === activeStamp ? "bg-white/20" : "hover:bg-white/10"}`}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* SVG overlay */}
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="absolute inset-0 w-full h-full"
        style={{ cursor: activeTool ? "crosshair" : "default" }}
        onClick={handleClick}
      >
        {annotations.map((ann) => {
          if (ann.type === "stamp") {
            return (
              <text
                key={ann.id}
                x={ann.x}
                y={ann.y}
                fontSize={ann.size}
                textAnchor="middle"
                dominantBaseline="central"
                style={{ pointerEvents: "none" }}
              >
                {ann.emoji}
              </text>
            );
          }
          if (ann.type === "text") {
            return (
              <text
                key={ann.id}
                x={ann.x}
                y={ann.y}
                fill={ann.color}
                fontSize={ann.fontSize}
                fontFamily="Inter, sans-serif"
                fontWeight="600"
                textAnchor="start"
                dominantBaseline="auto"
                style={{ pointerEvents: "none" }}
              >
                {ann.content}
              </text>
            );
          }
          if (ann.type === "arrow") {
            return (
              <line
                key={ann.id}
                x1={ann.x}
                y1={ann.y}
                x2={ann.endX}
                y2={ann.endY}
                stroke={ann.color}
                strokeWidth="3"
                markerEnd="url(#arrowhead)"
                style={{ pointerEvents: "none" }}
              />
            );
          }
          return null;
        })}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ffffff" />
          </marker>
        </defs>
      </svg>
    </div>
  );
}
