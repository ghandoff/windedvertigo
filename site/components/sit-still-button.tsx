"use client";

/**
 * Global "make this page sit still" button.
 *
 * A fixed bottom-right companion to the hello beacon (bottom-left). Clicking
 * it toggles the global animation pause state — stopping all kinetic CSS
 * animations and JS-driven animation loops sitewide. Preference persists via
 * localStorage.
 *
 * Accessibility: WCAG 2.1 SC 2.2.2 (pause / stop / hide). Explicit labels
 * for screen readers. Role="switch" communicates on/off state.
 *
 * Design: mirrors hello beacon aesthetic (lowercase, champagne text, same
 * weight and opacity). No border, no box — just text, so it reads as a
 * natural part of the page rather than a UI widget.
 */

import { useAnimations } from "@/lib/animation-context";

export function SitStillButton() {
  const { paused, toggle } = useAnimations();

  return (
    <button
      className={`sit-still-btn${paused ? " sit-still-btn--active" : ""}`}
      onClick={toggle}
      role="switch"
      aria-checked={paused}
      aria-label={
        paused
          ? "animations are paused — click to let the page move again"
          : "click to stop all animations on this page"
      }
    >
      {paused ? "let it move again" : "make this page sit still"}
    </button>
  );
}
