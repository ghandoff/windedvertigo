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
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <a
          href="https://windedvertigo.com/"
          className="text-sm font-bold text-white no-underline hover:opacity-80 transition-opacity"
        >
          winded.vertigo
        </a>
        <nav className="hidden sm:flex items-center gap-6" aria-label="main">
          <a
            href="#games"
            className="text-sm text-white/70 hover:text-white no-underline transition-colors"
          >
            games
          </a>
          <a
            href="#why"
            className="text-sm text-white/70 hover:text-white no-underline transition-colors"
          >
            why us
          </a>
          <a
            href="https://windedvertigo.com/what/"
            className="text-sm text-white/70 hover:text-white no-underline transition-colors"
          >
            about
          </a>
        </nav>
      </div>
    </header>
  );
}
