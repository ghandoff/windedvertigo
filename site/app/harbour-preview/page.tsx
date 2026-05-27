import type { Metadata } from "next";
import { HarbourHeader } from "./_components/harbour-header";
import { HarbourFooter } from "./_components/harbour-footer";
import { HarbourMap } from "./harbour-map";
import styles from "./harbour-map.module.css";

/**
 * /harbour-preview — placeholder for the SVG-map IA.
 *
 * Background: design session with Maria, Payton, and Fruit produced a
 * new harbour landing concept — a portrait SVG map (water + shorelines
 * + piers + clickable boats) replacing the side-scrolling pier rails
 * currently at /harbour. Fruit is producing the background SVG;
 * Payton is producing per-app boats. This route is the scaffold the
 * team can review now, with geometric placeholders that match the
 * mockup screenshot. Real artwork drops in as a file replacement
 * later (see TODO in harbour-map.tsx).
 *
 * Critically, this route does NOT replace /harbour. The 28 May PRME
 * launch surface stays untouched.
 *
 * Visibility: `noindex,nofollow` because we're sharing the URL
 * internally for review; we don't want search engines indexing the
 * placeholder.
 */

// Internal preview — force SSR so deploys are immediately visible without
// needing to purge the CDN cache. This page is noindex anyway.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "harbour preview — winded.vertigo",
  description: "preview of the harbour map IA. internal review only.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/harbour-preview" },
  openGraph: {
    type: "website",
    title: "harbour preview — winded.vertigo",
    description: "preview of the harbour map IA. internal review only.",
    url: "/harbour-preview",
    siteName: "winded.vertigo · harbour",
  },
};

export default function HarbourPreviewPage() {
  return (
    <>
      <HarbourHeader />
      <main id="main-content" className={styles.page}>
        <HarbourMap />
      </main>
      <HarbourFooter />
    </>
  );
}
