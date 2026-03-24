"use client";

import { useEffect } from "react";

/**
 * Behaviour-only component: on mount, smooth-scrolls to the element
 * matching the URL hash fragment (e.g. /hello#video).
 * Respects prefers-reduced-motion.  Renders nothing.
 */
export function HelloScroll() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;

    const el = document.getElementById(hash);
    if (!el) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    // small delay lets the page finish painting first
    const timer = setTimeout(() => {
      el.scrollIntoView({
        behavior: prefersReduced ? "instant" : "smooth",
        block: "start",
      });
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  return null;
}
