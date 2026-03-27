"use client";

import { useEffect, useRef } from "react";

/**
 * Fires a single page-view beacon to /api/track on mount.
 * Reads the __wv_utm cookie (set by middleware) server-side via the API route.
 */
export function TrackPageView() {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;

    const payload = {
      url: window.location.pathname + window.location.search,
      referrer: document.referrer,
    };

    // Use sendBeacon for reliability (fires even on page unload)
    // Fall back to fetch if sendBeacon isn't available
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/track", body);
    } else {
      fetch("/api/track", {
        method: "POST",
        body,
        headers: { "Content-Type": "application/json" },
        keepalive: true,
      }).catch(() => {
        // Tracking is non-critical — silently ignore failures
      });
    }
  }, []);

  return null;
}
