import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { TrackPageView } from "@/components/track-page-view";
import { HelloBeacon } from "@/components/hello-beacon";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "winded.vertigo",
  description:
    "winded.vertigo is a learning design collective building evidence-based educational experiences for global organisations including the UN Global Compact and the LEGO Foundation.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "winded.vertigo",
    description:
      "winded.vertigo is a learning design collective building evidence-based educational experiences for global organisations including the UN Global Compact and the LEGO Foundation.",
    url: "/",
    siteName: "winded.vertigo",
    images: [{ url: "/images/logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "winded.vertigo",
    description:
      "winded.vertigo is a learning design collective building evidence-based educational experiences for global organisations including the UN Global Compact and the LEGO Foundation.",
    images: ["/images/logo.png"],
  },
  icons: {
    icon: [
      { url: "/images/favicon.ico", type: "image/x-icon" },
      { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180" }],
  },
};

// Structured data as a static JSON string — no user input, safe to embed.
const STRUCTURED_DATA = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      name: "winded.vertigo",
      url: "https://www.windedvertigo.com",
      logo: "https://www.windedvertigo.com/images/logo.png",
      description:
        "winded.vertigo is a learning design collective building evidence-based educational experiences for global organisations including the UN Global Compact and the LEGO Foundation.",
      sameAs: [
        "https://www.instagram.com/windedvertigo",
        "https://www.linkedin.com/company/windedvertigo",
        "https://www.threads.net/@windedvertigo",
      ],
    },
    {
      "@type": "WebSite",
      name: "winded.vertigo",
      url: "https://www.windedvertigo.com",
    },
  ],
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <head>
        <Script
          id="structured-data"
          type="application/ld+json"
          strategy="beforeInteractive"
        >
          {STRUCTURED_DATA}
        </Script>
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          skip to main content
        </a>
        {children}
        <HelloBeacon />
        <TrackPageView />
        <Analytics />
      </body>
    </html>
  );
}
