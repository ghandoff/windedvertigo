import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import { TrackPageView } from "@/components/track-page-view";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "winded.vertigo",
  description:
    "a learning design collective dedicated to fostering human development through experiences with the interconnectedness of everything.",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    title: "winded.vertigo",
    description:
      "a learning design collective dedicated to fostering human development through experiences with the interconnectedness of everything.",
    url: "/",
    siteName: "winded.vertigo",
    images: [{ url: "/images/logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "winded.vertigo",
    description:
      "a learning design collective dedicated to fostering human development through experiences with the interconnectedness of everything.",
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
        "A learning design collective dedicated to fostering human development through experiences with the interconnectedness of everything.",
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
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
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
        <TrackPageView />
        <Analytics />
      </body>
    </html>
  );
}
