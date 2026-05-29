"use client";

import { useEffect, useState } from "react";

/**
 * Signed-in-aware personalization overlay for the canonical harbour scene.
 *
 * The harbour page (`/harbour`) is fully static + edge-cached for SEO and
 * anonymous visitors. This client overlay hydrates per-user state after mount
 * by fetching `/harbour/api/me` (served by the wv-harbour-harbour Worker and
 * reachable here because the `/harbour/:path*` fallback rewrite proxies it),
 * so the cached HTML stays identical for everyone.
 *
 * It (1) shows a welcome pill near the top of the scene for signed-in users,
 * and (2) marks owned boats — any `[data-boat]` whose slug is in `ownedApps`
 * (or all, for staff) gets an "⚓ yours" tag. The shared `HarbourMap` stays
 * purely presentational; annotation is imperative against its rendered DOM.
 */

interface Me {
  signedIn: boolean;
  name?: string | null;
  isStaff?: boolean;
  ownedApps?: string[];
}

export function HarbourGreeting() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/harbour/api/me", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMe(data as Me);
      })
      .catch(() => {
        /* best-effort; the static scene already rendered for everyone */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!me?.signedIn) return;
    const owned = new Set(me.ownedApps ?? []);
    const boats = document.querySelectorAll<HTMLElement>("[data-boat]");
    boats.forEach((el) => {
      if (el.dataset.harbourMarked) return; // idempotent
      const slug = el.dataset.boat ?? "";
      if (!(me.isStaff || owned.has(slug))) return;
      el.dataset.harbourMarked = "1";
      const tag = document.createElement("span");
      tag.textContent = "⚓ yours";
      tag.setAttribute("aria-label", "you have access to this");
      tag.style.cssText =
        "position:absolute;top:-6px;left:50%;transform:translateX(-50%);" +
        "z-index:30;white-space:nowrap;font-size:10px;font-weight:700;" +
        "padding:2px 7px;border-radius:9999px;letter-spacing:0.04em;" +
        "background:var(--wv-champagne,#ffebd2);color:var(--wv-cadet,#273248);" +
        "box-shadow:0 1px 4px rgba(0,0,0,.35);pointer-events:none;";
      if (getComputedStyle(el).position === "static") el.style.position = "relative";
      el.appendChild(tag);
    });
  }, [me]);

  if (!me?.signedIn) return null;

  return (
    <div
      aria-live="polite"
      style={{
        position: "absolute",
        // Clear the fixed SiteHeader (~104px) so the pill isn't occluded;
        // sits just below it, near the "tap any boat" hint.
        top: 116,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 40,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "5px 14px",
        borderRadius: 9999,
        fontSize: "0.8rem",
        background: "rgba(255,235,210,0.12)",
        border: "1px solid rgba(255,235,210,0.25)",
        color: "var(--wv-champagne, #ffebd2)",
        backdropFilter: "blur(4px)",
      }}
    >
      <span>
        {me.name ? `welcome aboard, ${me.name}.` : "welcome aboard."}
      </span>
      <a
        href="/harbour/account"
        style={{
          fontWeight: 700,
          color: "var(--wv-champagne, #ffebd2)",
          textUnderlineOffset: 3,
        }}
      >
        your harbour →
      </a>
    </div>
  );
}
