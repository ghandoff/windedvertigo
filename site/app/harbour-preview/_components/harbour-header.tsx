"use client";

/**
 * harbour-preview header.
 *
 * Intentionally simpler than `apps/harbour/components/header.tsx` in
 * harbour-apps: the live harbour hub has scroll-aware nav anchors
 * (#play / #finds / #us) that fit its single-page IA. The preview is a
 * tall scrollable map with no in-page sections worth jumping to, so
 * nav reduces to a logo (home) and a "back to live harbour" link.
 *
 * Styled inline + via scoped module to sidestep the fact that the site
 * Worker does NOT have Tailwind (the harbour-apps original is heavy on
 * Tailwind utilities). A future "real" harbour header for the map IA
 * can re-import these styles or branch into its own module.
 */

import { useEffect, useState } from "react";
import styles from "./harbour-header.module.css";

export function HarbourHeader() {
  // Add a backdrop after a small scroll so the header reads as separate
  // from the map below — without that, the cadet header bleeds into the
  // cadet water at the top of the SVG.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`${styles.header} ${scrolled ? styles.scrolled : ""}`}>
      <div className={styles.inner}>
        <a href="https://windedvertigo.com/" className={styles.brand} aria-label="winded.vertigo home">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://windedvertigo.com/images/logo.png"
            alt="winded.vertigo"
            className={styles.logo}
          />
        </a>
        <nav className={styles.nav} aria-label="harbour navigation">
          <a href="/harbour" className={styles.navLink}>
            ← live harbour
          </a>
        </nav>
      </div>
    </header>
  );
}
