import type { Metadata } from "next";
import Script from "next/script";
import {
  fetchRegenerativePractices,
  fetchCatalogueSchema,
} from "@/lib/notion";
import { CataloguePage } from "./catalogue-page";

export const revalidate = 300;

// Canonical moved to /harbour/regenerative-practices-catalogue ahead of the
// 28 May PRME launch. The legacy /portfolio/... URL still 301s here via
// next.config.ts redirects.
const OG_IMAGE =
  "https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/harbour-tiles/regenerative-practices.png";

export const metadata: Metadata = {
  title: "regenerative practices catalogue, winded.vertigo",
  description:
    "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
  alternates: {
    canonical: "/harbour/regenerative-practices-catalogue",
  },
  openGraph: {
    type: "website",
    siteName: "winded.vertigo · harbour",
    title: "regenerative practices catalogue: a living catalogue, by PRME faculty",
    description:
      "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
    url: "/harbour/regenerative-practices-catalogue",
    images: [{ url: OG_IMAGE, width: 1200, height: 720 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "regenerative practices catalogue: a living catalogue, by PRME faculty",
    description:
      "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
    images: [OG_IMAGE],
  },
};

// This page is a harbour app (lives under /harbour/...) and uses the
// shared harbour-nav-widget that every other harbour app loads, not the
// site-wide SiteHeader/SiteFooter.
//
// IMPORTANT: this component reads NO searchParams and no per-request state,
// so Next.js statically generates it and honours `revalidate = 300`. That
// lets OpenNext emit `Cache-Control: s-maxage=300, stale-while-revalidate`,
// which CF's edge caches — repeat requests are served from the edge without
// invoking the Worker at all. Do NOT add a `searchParams` (or `cookies()`,
// `headers()`) dependency here: any of them flips the page back to
// per-request dynamic rendering and the edge cache is lost.
//
// The visual-identity flag (?v=1) only swaps the page palette and is handled
// CLIENT-SIDE inside CataloguePage (see its useEffect) so it doesn't force
// dynamic rendering. v2 (olive + jade + cream) is the default; v1 (cadet +
// redwood + champagne) remains reachable via ?v=1 as a preview / rollback
// comparison. A true rollback = flip CataloguePage's default version and
// redeploy.
export default async function RegenerativeCataloguePage() {
  const [practices, schema] = await Promise.all([
    fetchRegenerativePractices(),
    fetchCatalogueSchema(),
  ]);

  return (
    <>
      <main id="main-content">
        <CataloguePage practices={practices} schema={schema} />
      </main>
      <Script
        src="/harbour-nav-widget.js"
        data-app="regenerative-practices-catalogue"
        strategy="afterInteractive"
      />
      <Script
        src="/feedback-widget.js"
        data-app-slug="regenerative-practices-catalogue"
        strategy="afterInteractive"
      />
    </>
  );
}
