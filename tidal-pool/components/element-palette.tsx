"use client";

/**
 * Draggable palette of elements for desktop, tap-to-add sheet for mobile.
 * On mobile: horizontal scrolling category tabs at the bottom with
 * safe area inset to avoid iOS Safari chrome.
 */

import { useState } from "react";
import type { PaletteItem, ElementCategory } from "@/lib/types";

interface ElementPaletteProps {
  items: PaletteItem[];
  onDragStart: (item: PaletteItem) => void;
  /** Mobile: called when user taps an element to add it at a default position. */
  onTapAdd?: (item: PaletteItem) => void;
}

const CATEGORY_META: Record<ElementCategory, { label: string; color: string; emoji: string }> =
  {
    natural: { label: "natural", color: "bg-blue-500", emoji: "🌿" },
    environmental: { label: "environ.", color: "bg-gray-500", emoji: "🌍" },
    economic: { label: "economic", color: "bg-purple-500", emoji: "💰" },
    social: { label: "social", color: "bg-orange-500", emoji: "👥" },
  };

export function ElementPalette({ items, onDragStart, onTapAdd }: ElementPaletteProps) {
  const [expandedCategory, setExpandedCategory] =
    useState<ElementCategory | null>("natural");
  const [mobileOpen, setMobileOpen] = useState(false);

  const categories = Object.keys(CATEGORY_META) as ElementCategory[];
  const grouped = new Map<ElementCategory, PaletteItem[]>();
  for (const item of items) {
    const list = grouped.get(item.category) ?? [];
    list.push(item);
    grouped.set(item.category, list);
  }

  const activeItems = expandedCategory ? grouped.get(expandedCategory) ?? [] : [];

  return (
    <>
      {/* ── Desktop: sidebar palette (hidden on mobile) ──────── */}
      <div className="hidden lg:flex w-56 shrink-0 flex-col gap-1 overflow-y-auto max-h-full">
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

      {/* ── Mobile: bottom sheet palette ──────────────────────── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col bg-[var(--wv-cadet)] border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* Expanded item tray */}
        {mobileOpen && (
          <div className="px-3 pt-2 pb-1 overflow-x-auto">
            <div className="flex gap-2 min-w-max">
              {activeItems.map((item) => (
                <button
                  key={item.slug}
                  onClick={() => onTapAdd?.(item)}
                  className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl bg-white/5 active:bg-white/15 transition-colors min-w-[64px]"
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="text-[10px] text-[var(--color-text-on-dark-muted)] whitespace-nowrap">
                    {item.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Category tabs */}
        <div className="flex items-center gap-1 px-2 py-2">
          {/* Toggle button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`shrink-0 w-9 h-9 flex items-center justify-center rounded-lg transition-all ${
              mobileOpen
                ? "bg-[var(--wv-redwood)] text-[var(--color-text-on-dark)]"
                : "bg-white/10 text-[var(--color-text-on-dark-muted)]"
            }`}
            aria-label={mobileOpen ? "Close palette" : "Open palette"}
          >
            {mobileOpen ? "✕" : "+"}
          </button>

          {/* Category pills */}
          <div className="flex gap-1 overflow-x-auto px-1">
            {categories.map((cat) => {
              const meta = CATEGORY_META[cat];
              const isActive = expandedCategory === cat;
              return (
                <button
                  key={cat}
                  onClick={() => {
                    setExpandedCategory(cat);
                    if (!mobileOpen) setMobileOpen(true);
                  }}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    isActive
                      ? "bg-white/15 text-[var(--color-text-on-dark)]"
                      : "text-[var(--color-text-on-dark-muted)]"
                  }`}
                >
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
