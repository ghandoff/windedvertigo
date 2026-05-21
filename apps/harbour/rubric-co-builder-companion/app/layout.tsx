import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Wordmark } from "./_components/wordmark";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "700"],
});

// OG image lives on R2 alongside the rest of the harbour tile placeholders.
// once the commissioned art lands, the R2 key gets overwritten and no code
// change is needed here.
const OG_IMAGE =
  "https://pub-60282cf378c248cf9317acfb691f6c99.r2.dev/harbour-tiles/co-rubric-companion.png";
const CANONICAL = "https://windedvertigo.com/harbour/co-rubric-companion";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "co.rubric companion — winded.vertigo",
  description:
    "a single-user worksheet that walks you through drafting a rubric for any learning artefact. free for the PRME community.",
  // robots: index off — companion is invite-only until the May 28 PRME launch.
  // remove `noindex` post-launch when the cohort has had the URL for a week.
  robots: { index: false, follow: false },
  alternates: { canonical: CANONICAL },
  openGraph: {
    type: "website",
    url: CANONICAL,
    siteName: "winded.vertigo · harbour",
    title: "co.rubric companion — co-design assessment with your class",
    description:
      "a single-user worksheet that walks you through drafting a rubric for any learning artefact. free for the PRME community.",
    images: [{ url: OG_IMAGE, width: 1200, height: 720 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "co.rubric companion — co-design assessment with your class",
    description:
      "draft a rubric for any learning artefact. free for the PRME community.",
    images: [OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a href="#main" className="skip-link">
          skip to content
        </a>
        {/*
          Page wrapper. The Wordmark footer is `position: fixed; bottom: 0`
          (see _components/wordmark.tsx) so it's always visible regardless
          of scroll position.

          Footer-clearance padding (pb-20) now lives INSIDE each step's
          own content area (see workshop.tsx) rather than on this wrapper.
          Reason: per-step bg colors (champagne/white) cover the workshop's
          full main area, including the clearance space, so there's no
          visible gap between step content and the fixed footer. PR #124's
          cadet wrapper bg was a workaround for the wrong layer — fixed
          properly here in PR #125.

          The flex column is preserved so per-page <main>s with `flex-1`
          keep working identically.
        */}
        <div
          id="main"
          tabIndex={-1}
          className="min-h-screen flex flex-col"
        >
          {children}
          <Wordmark />
        </div>
        <Script
          src="https://windedvertigo.com/feedback-widget.js"
          data-app-slug="co-rubric-companion"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
