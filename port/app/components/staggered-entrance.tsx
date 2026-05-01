"use client";

import React from "react";

/**
 * CSS-only staggered entrance animation.
 * Wraps each child in a div that plays the `fade-in-up` keyframes
 * with increasing delay (index * 50 ms).
 *
 * Reduced-motion users are already covered — the global kill-switch
 * in lib/shared/tokens/index.css zeroes out animation-duration.
 */
export function StaggeredEntrance({ children }: { children: React.ReactNode }) {
  return (
    <>
      {React.Children.map(children, (child, index) => (
        <div
          style={{
            opacity: 0,
            animation: "fade-in-up 300ms ease-out both",
            animationDelay: `${index * 50}ms`,
          }}
        >
          {child}
        </div>
      ))}
    </>
  );
}
