import type { Metadata } from "next";
import Script from "next/script";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  fetchRegenerativePractices,
  fetchCatalogueSchema,
  fetchSiteContent,
} from "@/lib/notion";
import { CataloguePage } from "./catalogue-page";

export const revalidate = 300;

// Canonical moved to /harbour/regenerative-practices-catalogue ahead of the
// 28 May PRME launch — the legacy /portfolio/... URL still 301s here via
// next.config.ts redirects.
const OG_IMAGE =
  "https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/harbour-tiles/regenerative-practices.png";

export const metadata: Metadata = {
  title: "regenerative practices catalogue — winded.vertigo",
  description:
    "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
  alternates: {
    canonical: "/harbour/regenerative-practices-catalogue",
  },
  openGraph: {
    type: "website",
    siteName: "winded.vertigo · harbour",
    title: "regenerative practices catalogue — a living catalogue, by PRME faculty",
    description:
      "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
    url: "/harbour/regenerative-practices-catalogue",
    images: [{ url: OG_IMAGE, width: 1200, height: 720 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "regenerative practices catalogue — a living catalogue, by PRME faculty",
    description:
      "a living catalogue of regenerative teaching practices, designed by faculty in the PPCS programme.",
    images: [OG_IMAGE],
  },
};

export default async function RegenerativeCataloguePage() {
  const [practices, schema, homeSections] = await Promise.all([
    fetchRegenerativePractices(),
    fetchCatalogueSchema(),
    fetchSiteContent("home"),
  ]);

  return (
    <>
      <SiteHeader />
      <main id="main-content">
        <CataloguePage practices={practices} schema={schema} />
      </main>
      <SiteFooter sections={homeSections} />
      <Script
        src="/feedback-widget.js"
        data-app-slug="regenerative-practices-catalogue"
        strategy="afterInteractive"
      />
    </>
  );
}
