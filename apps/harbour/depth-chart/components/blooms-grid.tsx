"use client";

import { useState } from "react";
import { BLOOMS_ORDER, BLOOMS_LEVELS } from "@/lib/blooms";

export default function BloomsGrid() {
  const [hovered, set_hovered] = useState<string | null>(null);

  return (
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {BLOOMS_ORDER.map((level) => {
        const info = BLOOMS_LEVELS[level];
        const is_active = hovered === level;
        const glow_light = `color-mix(in srgb, ${info.color} 12%, transparent)`;
        const glow_mid = `color-mix(in srgb, ${info.color} 25%, transparent)`;
        const pill_bg = `color-mix(in srgb, ${info.color} 15%, transparent)`;

        return (
          <div
            key={level}
            onMouseEnter={() => set_hovered(level)}
            onMouseLeave={() => set_hovered(null)}
            className="relative bg-white/5 border rounded-lg p-4 space-y-1 transition-all duration-300 cursor-default overflow-hidden"
            style={{
              borderColor: is_active ? info.color : "rgba(255,255,255,0.1)",
              transform: is_active ? "translateY(-2px)" : "translateY(0)",
              boxShadow: is_active
                ? `0 8px 24px ${glow_light}, 0 0 0 1px ${glow_mid}`
                : "none",
            }}
          >
            {/* color accent bar — expands on hover */}
            <div
              className="absolute left-0 top-0 bottom-0 transition-all duration-300"
              style={{
                width: is_active ? "3px" : "0px",
                backgroundColor: info.color,
              }}
            />

            <div className="flex items-center gap-2">
              <span
                className="rounded-full transition-all duration-300"
                style={{
                  backgroundColor: info.color,
                  width: is_active ? "10px" : "8px",
                  height: is_active ? "10px" : "8px",
                }}
              />
              <span className="text-sm font-semibold text-[var(--color-text-on-dark)]">
                {info.label}
              </span>
              <span className="text-[10px] text-[var(--color-text-on-dark-muted)] ml-auto">
                {info.category}
              </span>
            </div>

            <p className="text-xs text-[var(--color-text-on-dark-muted)]">
              {info.description}
            </p>

            {/* verbs — stagger in on hover */}
            <div className="flex flex-wrap gap-1 pt-1">
              {info.example_verbs.slice(0, 5).map((verb, i) => (
                <span
                  key={verb}
                  className="text-[10px] px-1.5 py-0.5 rounded transition-all duration-300"
                  style={{
                    backgroundColor: is_active ? pill_bg : "transparent",
                    color: is_active
                      ? info.color
                      : "var(--color-text-on-dark-muted)",
                    opacity: is_active ? 1 : 0.6,
                    transitionDelay: is_active ? `${i * 40}ms` : "0ms",
                  }}
                >
                  {verb}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
