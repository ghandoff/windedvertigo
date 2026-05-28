"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Shared site header with logo, navigation, and mobile toggle.
 * Renders nothing on the home page (home has its own hero nav).
 */
export function SiteHeader({ isHome = false }: { isHome?: boolean }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="header">
      <div className="container header-inner">
        <Link href="/" className="logo">
          <picture>
            <source srcSet="/images/logo.webp" type="image/webp" />
            <Image
              src="/images/logo.png"
              alt="winded.vertigo"
              className="logo-img"
              width={200}
              height={106}
              priority
            />
          </picture>
        </Link>

        {!isHome && (
          <>
            <button
              className="nav-toggle"
              aria-label="toggle navigation"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              ☰
            </button>
            <nav
              className={`nav${menuOpen ? " active" : ""}`}
              aria-label="main navigation"
            >
              <Link href="/what/">what.</Link>
              <Link href="/we/">we.</Link>
              <span className="nav-do-group">
                <a href="/do/">do</a>
                <a href="/quadrants/" className="portfolio-dot" aria-label="quadrants">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="1" y="1" width="10" height="10" rx="1" />
                    <rect x="13" y="1" width="10" height="10" rx="1" />
                    <rect x="1" y="13" width="10" height="10" rx="1" />
                    <rect x="13" y="13" width="10" height="10" rx="1" />
                  </svg>
                </a>
              </span>
            </nav>
          </>
        )}
      </div>
    </header>
  );
}
