"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/**
 * Fires a fire-and-forget POST to /api/analytics/pageview on every route
 * change. Mounted in the dashboard layout so every authenticated page is
 * covered. Duplicate rapid navigations are suppressed with a 300ms debounce.
 */
export function PageViewLogger() {
  const pathname = usePathname();
  const lastLogged = useRef<string>("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (pathname === lastLogged.current) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      lastLogged.current = pathname;
      fetch("/api/analytics/pageview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: pathname }),
        // don't block navigation
        keepalive: true,
      }).catch(() => {/* silent */});
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [pathname]);

  return null;
}
