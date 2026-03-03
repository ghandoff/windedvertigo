"use client";

import { useEffect, useState } from "react";

export function Header() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initial check
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "bg-[var(--wv-cadet)]/95 backdrop-blur-sm border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div
        className="flex items-center justify-between"
        style={{ padding: "var(--space-lg) var(--edge-padding, 30px)" }}
      >
        {/* Logo — matches the global site header */}
        <a href="https://windedvertigo.com/" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://windedvertigo.com/images/logo.png"
            alt="winded.vertigo"
            className="h-auto"
            style={{ width: 200 }}
          />
        </a>

        {/* Reservoir navigation */}
        <nav className="hidden sm:flex items-center gap-6" aria-label="main">
          <a
            href="#games"
            className="text-white/70 hover:text-white no-underline transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 400,
              letterSpacing: "var(--letter-spacing-body)",
            }}
          >
            games
          </a>
          <a
            href="#why"
            className="text-white/70 hover:text-white no-underline transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 400,
              letterSpacing: "var(--letter-spacing-body)",
            }}
          >
            why us
          </a>
          <a
            href="https://windedvertigo.com/what/"
            className="text-white/70 hover:text-white no-underline transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.875rem",
              fontWeight: 400,
              letterSpacing: "var(--letter-spacing-body)",
            }}
          >
            about
          </a>
        </nav>
      </div>
    </header>
  );
}
