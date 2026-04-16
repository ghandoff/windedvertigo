"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

/**
 * A playful, emergent "hello." element that appears on every page after a
 * short delay — like discovering a hidden path. Links to /hello/.
 *
 * Behaviour:
 *  - Fades in after 3 seconds with a gentle drift animation
 *  - Positioned in the bottom-left corner, above the footer
 *  - On hover: shifts colour (champagne → redwood) and grows slightly
 *  - Respects prefers-reduced-motion (renders immediately, no animation)
 *  - Hidden on the /hello/ page itself (no need to link to where you are)
 */
export function HelloBeacon() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show on the hello page itself
    if (window.location.pathname.startsWith("/hello")) return;

    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (prefersReduced) {
      setVisible(true);
      return;
    }

    const timer = setTimeout(() => setVisible(true), 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <Link
      href="/hello/"
      className={`hello-beacon${visible ? " hello-beacon--visible" : ""}`}
      aria-label="say hello — get to know winded.vertigo"
    >
      hello.
    </Link>
  );
}
