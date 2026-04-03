"use client";

/**
 * Draggable palette of elements that can be dropped onto the pool canvas.
 * Grouped by category with a collapsed/expanded toggle.
 */

import { useState } from "react";
import type { PaletteItem, ElementCategory } from "@/lib/types";

interface ElementPaletteProps {
  items: PaletteItem[];
  onDragStart: (item: PaletteItem) => void;
}

const CATEGORY_META: Record<ElementCategory, { label: string; color: string }> =
  {
    natural: { label: "natural", color: "bg-blue-500" },
    environmental: { label: "environmental", color: "bg-gray-500" },
    economic: { label: "economic", color: "bg-purple-500" },
    social: { label: "social", color: "bg-orange-500" },
  };

export function ElementPalette({ items, onDragStart }: ElementPaletteProps) {
  const [expandedCategory, setExpandedCategory] =
    useState<ElementCategory | null>("natural");

  // Group by category
  const categories = Object.keys(CATEGORY_META) as ElementCategory[];
  const grouped = new Map<ElementCategory, PaletteItem[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  return (
    <div className="w-56 shrink-0 flex flex-col gap-1 overflow-y-auto max-h-full">
      <p className="text-xs text-[var(--color-text-on-dark-muted)] px-3 py-2 tracking-wider">
        elements
      </p>

      {categories.map((cat) => {
        const meta = CATEGORY_META[cat];
        const catItems = grouped.get(cat) ?? [];
        if (catItems.length === 0) return null;

        const isExpanded = expandedCategory === cat;

        return (
          <div key={cat}>
            <button
              onClick={() =>
                setExpandedCategory(isExpanded ? null : cat)
              }
              className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/5 rounded-lg transition-colors"
            >
              <span
                className={`w-2 h-2 rounded-full ${meta.color} shrink-0`}
              />
              <span className="text-xs font-semibold text-[var(--color-text-on-dark)] tracking-wider">
                {meta.label}
              </span>
              <span
                className={`ml-auto text-[var(--color-text-on-dark-muted)] text-xs transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
              >
                ›
              </span>
            </button>

            {isExpanded && (
              <div className="flex flex-col gap-0.5 pl-2">
                {catItems.map((item) => (
                  <div
                    key={item.slug}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData(
                        "application/tidal-pool-element",
                        item.slug,
                      );
                      onDragStart(item);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors group"
                    title={item.description}
                  >
                    <span className="text-lg">{item.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-[var(--color-text-on-dark)] truncate">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-on-dark-muted)] truncate opacity-0 group-hover:opacity-100 transition-opacity">
                        {item.description}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
