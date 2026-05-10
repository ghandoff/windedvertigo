import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CollabTypewriter } from "@/components/collab-variants/collab-typewriter";
import { CollabTide } from "@/components/collab-variants/collab-tide";
import { fetchSiteContent } from "@/lib/notion";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "collab mockups — winded.vertigo lab",
  robots: { index: false, follow: false },
};

export default async function LabPage() {
  const sections = await fetchSiteContent("home");
  const meta = sections.find((s) => s.name === "meta" || s.section === "meta");

  return (
    <main id="main-content">

      {/* ── Mockup 1 — typewriter ──────────────────────────────── */}
      <div id="variant-typewriter" className="lab-variant-block">
        <div className="lab-variant-tag" aria-hidden="true">#2 — typewriter roll</div>

        <SiteHeader isHome />

        <div className="home">
          <div className="container">
            <section className="hero">
              <h2 className="visually-hidden">winded.vertigo</h2>
              <nav className="hero-nav" aria-label="main navigation">
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
              {meta?.content && (
                <p className="home-meta">{meta.content}</p>
              )}
            </section>
          </div>
        </div>

        <CollabTypewriter />

        <SiteFooter sections={sections} />
      </div>

      {/* ── Divider ───────────────────────────────────────────── */}
      <div className="lab-mockup-divider" aria-hidden="true">
        <span>↑ typewriter · slow tide ↓</span>
      </div>

      {/* ── Mockup 2 — slow tide ──────────────────────────────── */}
      <div id="variant-tide" className="lab-variant-block">
        <div className="lab-variant-tag" aria-hidden="true">#13 — slow tide</div>

        <SiteHeader isHome />

        <div className="home">
          <div className="container">
            <section className="hero">
              <h2 className="visually-hidden">winded.vertigo</h2>
              <nav className="hero-nav" aria-label="main navigation">
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
              {meta?.content && (
                <p className="home-meta">{meta.content}</p>
              )}
            </section>
          </div>
        </div>

        <CollabTide />

        <SiteFooter sections={sections} />
      </div>

    </main>
  );
}
