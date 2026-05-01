"use client";

/**
 * Shared harbour navigation bar — rendered at the top of every harbour app.
 *
 * Client component (needs useState for mobile menu toggle).
 * Each app's layout calls auth() locally and passes the session data as props.
 * The nav itself has no auth dependency.
 *
 * Uses the .wv-header* CSS classes from @windedvertigo/tokens.
 */

import { useState, useEffect, useCallback } from "react";

const HARBOUR_APPS = [
  {
    key: "creaseworks",
    label: "creaseworks",
    href: "/harbour/creaseworks",
    tagline: "creative playdates",
  },
  {
    key: "vertigo-vault",
    label: "vertigo.vault",
    href: "/harbour/vertigo-vault",
    tagline: "learning activities",
  },
  {
    key: "depth-chart",
    label: "depth.chart",
    href: "/harbour/depth-chart",
    tagline: "assessment generator",
  },
  {
    key: "deep-deck",
    label: "deep.deck",
    href: "/harbour/deep-deck",
    tagline: "conversation cards",
  },
  {
    key: "raft-house",
    label: "raft.house",
    href: "/harbour/raft-house",
    tagline: "group learning",
  },
  {
    key: "tidal-pool",
    label: "tidal.pool",
    href: "/harbour/tidal-pool",
    tagline: "systems thinking sandbox",
  },
  {
    key: "paper-trail",
    label: "paper.trail",
    href: "/harbour/paper-trail",
    tagline: "physical-digital bridge",
  },
  {
    key: "mirror-log",
    label: "mirror.log",
    href: "/harbour/mirror-log",
    tagline: "reflection journal",
  },
  // ── threshold concept apps ──
  {
    key: "orbit-lab",
    label: "orbit.lab",
    href: "/harbour/orbit-lab",
    tagline: "orbital mechanics",
  },
  {
    key: "proof-garden",
    label: "proof.garden",
    href: "/harbour/proof-garden",
    tagline: "mathematical proof",
  },
  {
    key: "bias-lens",
    label: "bias.lens",
    href: "/harbour/bias-lens",
    tagline: "cognitive bias",
  },
  {
    key: "scale-shift",
    label: "scale.shift",
    href: "/harbour/scale-shift",
    tagline: "powers of ten",
  },
  {
    key: "pattern-weave",
    label: "pattern.weave",
    href: "/harbour/pattern-weave",
    tagline: "gestalt perception",
  },
  {
    key: "market-mind",
    label: "market.mind",
    href: "/harbour/market-mind",
    tagline: "opportunity cost",
  },
  {
    key: "rhythm-lab",
    label: "rhythm.lab",
    href: "/harbour/rhythm-lab",
    tagline: "subdivision & groove",
  },
  {
    key: "code-weave",
    label: "code.weave",
    href: "/harbour/code-weave",
    tagline: "recursion & abstraction",
  },
  {
    key: "time-prism",
    label: "time.prism",
    href: "/harbour/time-prism",
    tagline: "historical empathy",
  },
  {
    key: "liminal-pass",
    label: "liminal.pass",
    href: "/harbour/liminal-pass",
    tagline: "threshold concepts",
  },
  {
    key: "emerge-box",
    label: "emerge.box",
    href: "/harbour/emerge-box",
    tagline: "cellular automata",
  },
] as const;

export type HarbourAppKey =
  | "creaseworks"
  | "vertigo-vault"
  | "depth-chart"
  | "deep-deck"
  | "raft-house"
  | "tidal-pool"
  | "paper-trail"
  | "mirror-log"
  | "orbit-lab"
  | "proof-garden"
  | "bias-lens"
  | "scale-shift"
  | "pattern-weave"
  | "market-mind"
  | "rhythm-lab"
  | "code-weave"
  | "time-prism"
  | "liminal-pass"
  | "emerge-box";

export interface HarbourNavProps {
  currentApp: HarbourAppKey;
  user?: {
    name?: string | null;
    email?: string | null;
  } | null;
  signInPath?: string;
  signOutPath?: string;
}

export function HarbourNav({
  currentApp,
  user,
  signInPath,
  signOutPath,
}: HarbourNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const otherApps = HARBOUR_APPS.filter((app) => app.key !== currentApp);
  const current = HARBOUR_APPS.find((app) => app.key === currentApp);
  const basePath = `/harbour/${currentApp}`;
  const resolvedSignIn = signInPath ?? `${basePath}/login`;
  const resolvedSignOut = signOutPath ?? `${basePath}/api/auth/signout`;

  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape" && menuOpen) setMenuOpen(false);
    },
    [menuOpen],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <header className="wv-header harbour-nav" style={{ position: "sticky", top: 0, zIndex: 50 }}>
      <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md, 16px)" }}>
        <a
          href="/harbour"
          className="wv-header-brand"
          style={{ opacity: 0.5, fontSize: "0.75rem" }}
        >
          harbour
        </a>
        <span
          style={{
            color: "var(--wv-champagne, #ffebd2)",
            opacity: 0.3,
            fontSize: "0.75rem",
          }}
        >
          /
        </span>
        <span className="wv-header-brand">{current?.label ?? currentApp}</span>
      </div>

      {/* Hamburger toggle — visible only on mobile (< 640px) */}
      <button
        className="harbour-nav-toggle"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={menuOpen ? "close navigation menu" : "open navigation menu"}
        aria-expanded={menuOpen}
      >
        <span style={{ fontSize: "1.125rem", lineHeight: 1 }}>
          {menuOpen ? "✕" : "☰"}
        </span>
      </button>

      {/* Desktop nav — hidden on mobile via CSS */}
      <nav className="wv-header-nav" aria-label="harbour apps">
        {otherApps.map((app) => (
          <a
            key={app.key}
            href={app.href}
            className="wv-header-nav-link"
            title={app.tagline}
          >
            {app.label}
          </a>
        ))}

        {user ? (
          <span style={{ display: "flex", alignItems: "center", gap: "var(--space-sm, 8px)" }}>
            <span className="wv-header-email">
              {user.name ?? user.email}
            </span>
            <a href={resolvedSignOut} className="wv-header-signout" style={{ textDecoration: "none" }}>
              sign out
            </a>
          </span>
        ) : (
          <a href={resolvedSignIn} className="wv-header-nav-link" data-accent="">
            sign in
          </a>
        )}
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="harbour-nav-mobile-menu" role="navigation" aria-label="harbour apps mobile">
          {otherApps.map((app) => (
            <a
              key={app.key}
              href={app.href}
              className="harbour-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
            >
              <span>{app.label}</span>
              <span className="harbour-nav-mobile-tagline">{app.tagline}</span>
            </a>
          ))}

          <div className="harbour-nav-mobile-divider" />

          {user ? (
            <div className="harbour-nav-mobile-user">
              <span className="wv-header-email">
                {user.name ?? user.email}
              </span>
              <a
                href={resolvedSignOut}
                className="harbour-nav-mobile-link"
                onClick={() => setMenuOpen(false)}
                style={{ color: "var(--color-accent-on-dark, #e09878)" }}
              >
                sign out
              </a>
            </div>
          ) : (
            <a
              href={resolvedSignIn}
              className="harbour-nav-mobile-link"
              onClick={() => setMenuOpen(false)}
              style={{ color: "var(--color-accent-on-dark, #e09878)" }}
            >
              sign in
            </a>
          )}
        </div>
      )}
    </header>
  );
}
