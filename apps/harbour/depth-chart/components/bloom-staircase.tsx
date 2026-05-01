"use client";

import { useEffect, useState } from "react";
import { BLOOMS_ORDER, BLOOMS_LEVELS } from "@/lib/blooms";

export default function BloomStaircase() {
  const [mounted, set_mounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => set_mounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="flex items-end justify-center gap-1.5 sm:gap-2 h-48 sm:h-56 select-none" aria-hidden="true">
      {BLOOMS_ORDER.map((level, i) => {
        const info = BLOOMS_LEVELS[level];
        // each bar is taller than the last — 30px base + 25px per step
        const height = 30 + (i + 1) * 25;

        return (
          <div
            key={level}
            className="group relative flex flex-col items-center"
            style={{ height: `${height}px` }}
          >
            {/* the bar */}
            <div
              className="w-10 sm:w-14 rounded-t-md transition-all duration-700 ease-out flex-1"
              style={{
                backgroundColor: info.color,
                opacity: mounted ? 0.85 : 0,
                transform: mounted ? "scaleY(1)" : "scaleY(0)",
                transformOrigin: "bottom",
                transitionDelay: `${i * 100 + 200}ms`,
              }}
            />

            {/* label below */}
            <span
              className="text-[9px] sm:text-[10px] font-semibold mt-1.5 transition-all duration-500"
              style={{
                color: info.color,
                opacity: mounted ? 1 : 0,
                transitionDelay: `${i * 100 + 600}ms`,
              }}
            >
              {info.label}
            </span>

            {/* tooltip on hover */}
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap">
              <span className="text-[9px] bg-black/80 text-white px-2 py-1 rounded">
                {info.category === "hocs" ? "higher-order" : "lower-order"}
              </span>
            </div>
          </div>
        );
      })}

      {/* LOCS / HOCS divider line */}
      <div
        className="absolute left-1/2 -translate-x-1/2 top-1/4 text-[9px] tracking-widest font-semibold transition-opacity duration-500 hidden sm:flex items-center gap-3"
        style={{ opacity: mounted ? 0.4 : 0, transitionDelay: "1200ms" }}
      >
        <span className="text-[var(--color-text-on-dark-muted)]">locs</span>
        <span className="w-8 h-px bg-white/20" />
        <span className="text-[var(--color-text-on-dark-muted)]">hocs</span>
      </div>
    </div>
  );
}
