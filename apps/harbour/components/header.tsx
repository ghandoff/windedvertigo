"use client";

import { useEffect, useState } from "react";

const NAV_LINKS = [
  { href: "#games", label: "games." },
  { href: "#reveal", label: "reveal." },
  { href: "#connection", label: "connection." },
];

const navLinkStyle = {
  fontFamily: "var(--font-body)",
  fontSize: 32,
  fontWeight: 800,
  textTransform: "lowercase" as const,
};

export function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll(); // initial check
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // close mobile menu on hash navigation
  useEffect(() => {
    if (!menuOpen) return;
    const close = () => setMenuOpen(false);
    window.addEventListener("hashchange", close);
    return () => window.removeEventListener("hashchange", close);
  }, [menuOpen]);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-300 ${
        scrolled || menuOpen
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

        {/* Mobile hamburger button */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-2"
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          aria-label={menuOpen ? "close menu" : "open menu"}
        >
          <span
            className={`block w-6 h-0.5 bg-[var(--wv-champagne)] transition-transform duration-200 ${
              menuOpen ? "rotate-45 translate-y-2" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-[var(--wv-champagne)] transition-opacity duration-200 ${
              menuOpen ? "opacity-0" : ""
            }`}
          />
          <span
            className={`block w-6 h-0.5 bg-[var(--wv-champagne)] transition-transform duration-200 ${
              menuOpen ? "-rotate-45 -translate-y-2" : ""
            }`}
          />
        </button>

        {/* Desktop navigation */}
        <nav
          className="hidden md:flex items-center"
          style={{ gap: 30 }}
          aria-label="site navigation"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-[var(--color-text-on-dark)] hover:text-[var(--wv-champagne)] no-underline transition-colors"
              style={navLinkStyle}
            >
              {link.label}
            </a>
          ))}
        </nav>
      </div>

      {/* Mobile navigation */}
      {menuOpen && (
        <nav
          id="mobile-nav"
          className="md:hidden flex flex-col items-center gap-6 pb-8 bg-[var(--wv-cadet)]/95 backdrop-blur-sm"
          aria-label="site navigation"
        >
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-[var(--color-text-on-dark)] hover:text-[var(--wv-champagne)] no-underline transition-colors"
              style={{ ...navLinkStyle, fontSize: 24 }}
            >
              {link.label}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}
