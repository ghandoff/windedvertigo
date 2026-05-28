import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { HarbourMap } from "../harbour-preview/harbour-map";
import styles from "../harbour-preview/harbour-map.module.css";

/**
 * /harbour — the public harbour landing.
 *
 * The SVG harbour scene with clickable, bobbing boats (the experience
 * staged at /harbour-preview) is now the canonical harbour, wrapped in
 * the standard windedvertigo.com header + footer plus a sign-in link.
 *
 * Routing: this local route intercepts `/harbour` exactly, BEFORE the
 * `fallback` rewrite in next.config.ts. Sub-paths are unaffected —
 *   /harbour/<app>      → beforeFiles rewrites → individual app Workers
 *   /harbour/login,
 *   /harbour/account    → /harbour/:path* fallback → wv-harbour-harbour hub Worker
 *   /harbour/api/auth*  → direct CF Worker Routes on the hub (Pool A SSO)
 * The old hub landing remains deployed as a backup at
 * wv-harbour-harbour.windedvertigo.workers.dev/harbour.
 *
 * Rendering: fully static (no Notion fetch — SiteFooter uses defaults),
 * no per-request inputs, so it stays edge/KV cacheable.
 */

const OG_IMAGE =
  "https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/harbour-tiles/harbour-hub.png";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "the harbour — winded.vertigo",
  description:
    "a harbour of playful tools for connection, creativity, and growth. tap a boat to explore.",
  alternates: { canonical: "/harbour" },
  openGraph: {
    type: "website",
    title: "the harbour — winded.vertigo",
    description:
      "a harbour of playful tools for connection, creativity, and growth. tap a boat to explore.",
    url: "/harbour",
    siteName: "winded.vertigo · harbour",
    images: [{ url: OG_IMAGE, width: 1200, height: 720 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "the harbour — winded.vertigo",
    description:
      "a harbour of playful tools for connection, creativity, and growth. tap a boat to explore.",
    images: [OG_IMAGE],
  },
};

export default function HarbourPage() {
  return (
    <>
      <SiteHeader signInHref="/harbour/login" />
      <main id="main-content" className={styles.page}>
        <HarbourMap />
      </main>
      <SiteFooter />
    </>
  );
}
