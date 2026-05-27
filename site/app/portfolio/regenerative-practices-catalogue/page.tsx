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
// site-wide SiteHeader/SiteFooter. The visual-identity flag (?v=1) only
// swaps the page palette; the navbar is the same for both versions.
// v2 (olive + jade + cream) is the default; v1 (cadet + redwood +
// champagne) remains reachable via ?v=1 as a rollback escape hatch.
export default async function RegenerativeCataloguePage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const params = await searchParams;
  const version = params.v === "1" ? 1 : 2;

  const [practices, schema] = await Promise.all([
    fetchRegenerativePractices(),
    fetchCatalogueSchema(),
  ]);

  return (
    <>
      <main id="main-content">
        <CataloguePage practices={practices} schema={schema} version={version} />
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
