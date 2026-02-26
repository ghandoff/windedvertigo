"use client";

import type { ReactNode } from "react";

/**
 * Client wrapper for interactive action slots inside server-rendered cards.
 * Stops click propagation so parent <Link> doesn't navigate.
 */
export default function CardActionSlot({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-3 pt-3 border-t border-cadet/5"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.stopPropagation();
        }
      }}
      role="presentation"
    >
      {children}
    </div>
  );
}
