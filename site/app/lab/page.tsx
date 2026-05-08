import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { CollabTypewriter } from "@/components/collab-variants/collab-typewriter";
import { CollabGravity } from "@/components/collab-variants/collab-gravity";
import { CollabTide } from "@/components/collab-variants/collab-tide";
import { CollabHeatmap } from "@/components/collab-variants/collab-heatmap";
import { CollabPhosphor } from "@/components/collab-variants/collab-phosphor";
import { CollabBreath } from "@/components/collab-variants/collab-breath";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "collab mockups — winded.vertigo lab",
  robots: { index: false, follow: false },
};

const VARIANTS = [
  { id: "typewriter",  label: "#2 — typewriter roll",       Component: CollabTypewriter },
  { id: "gravity",     label: "#11 — gravitational orbit",  Component: CollabGravity },
  { id: "tide",        label: "#13 — slow tide",            Component: CollabTide },
  { id: "heatmap",     label: "#18 — heat map",             Component: CollabHeatmap },
  { id: "phosphor",    label: "#26 — phosphorescent bloom", Component: CollabPhosphor },
  { id: "breath",      label: "#28 — breath",               Component: CollabBreath },
];

export default function LabPage() {
  return (
    <>
      <SiteHeader />

      <main id="main-content">
        {/* Lab header */}
        <div className="container content-narrow" style={{ paddingTop: "var(--space-2xl)", paddingBottom: "var(--space-lg)" }}>
          <p className="lab-eyebrow">mockup preview</p>
          <h2 className="hero-title">collab section variants</h2>
          <p className="lab-description">
            six mobile-first approaches to "organisations we play with" — each
            shown in full homepage context. scroll to compare. no marquee.
            includes phosphorescent bloom (#26) and breath (#28).
          </p>
          <nav className="lab-nav" aria-label="jump to variant">
            {VARIANTS.map((v) => (
              <a key={v.id} href={`#variant-${v.id}`} className="lab-nav-link">
                {v.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Each variant gets the same homepage context: header already above,
            content area implied, then the collab section, then a divider */}
        {VARIANTS.map((v, i) => (
          <section
            key={v.id}
            id={`variant-${v.id}`}
            className="lab-variant-block"
            aria-label={v.label}
          >
            {/* Sticky label */}
            <div className="lab-variant-tag" aria-hidden="true">
              {v.label}
            </div>

            {/* Simulated page body — mimics the blank space above the collab strip */}
            <div className="lab-page-spacer" aria-hidden="true">
              <div className="container content-narrow">
                <p className="lab-spacer-text">
                  ↑ imagine the rest of the page above this line ↑
                </p>
              </div>
            </div>

            {/* The actual variant */}
            <v.Component />

            {/* Footer context */}
            <SiteFooter />

            {/* Divider between variants (except last) */}
            {i < VARIANTS.length - 1 && (
              <div className="lab-divider" aria-hidden="true" />
            )}
          </section>
        ))}
      </main>
    </>
  );
}
