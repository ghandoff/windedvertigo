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
        {/* Logo — matches the global site header (200px desktop, 150px mobile) */}
        <a href="https://windedvertigo.com/" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://windedvertigo.com/images/logo.png"
            alt="winded.vertigo"
            className="h-auto w-[150px] md:w-[200px]"
          />
        </a>

        {/* Reservoir navigation — matches global site nav typography */}
        <nav
          className="hidden md:flex items-center"
          style={{ gap: 30 }}
          aria-label="main"
        >
          <a
            href="#games"
            className="text-white hover:text-[var(--wv-champagne)] no-underline transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 32,
              fontWeight: 800,
              textTransform: "lowercase" as const,
            }}
          >
            games.
          </a>
          <a
            href="#why"
            className="text-white hover:text-[var(--wv-champagne)] no-underline transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 32,
              fontWeight: 800,
              textTransform: "lowercase" as const,
            }}
          >
            why us.
          </a>
          <a
            href="https://windedvertigo.com/what/"
            className="text-white hover:text-[var(--wv-champagne)] no-underline transition-colors"
            style={{
              fontFamily: "var(--font-body)",
              fontSize: 32,
              fontWeight: 800,
              textTransform: "lowercase" as const,
            }}
          >
            about.
          </a>
        </nav>
      </div>
    </header>
  );
}
