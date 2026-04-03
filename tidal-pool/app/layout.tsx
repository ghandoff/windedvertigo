import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "tidal.pool — the harbour",
  description:
    "a systems thinking sandbox. drop elements, draw connections, and watch emergent behaviors ripple through your pool.",
  alternates: { canonical: "/harbour/tidal-pool" },
  openGraph: {
    type: "website",
    title: "tidal.pool — the harbour",
    description:
      "a systems thinking sandbox from winded.vertigo. explore feedback loops, cause-and-effect, and the interconnectedness of everything.",
    url: "/harbour/tidal-pool",
    siteName: "winded.vertigo",
  },
};

export default function TidalPoolLayout({
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
      </head>
      <body className="bg-[var(--wv-cadet)] text-[var(--color-text-on-dark)] font-[family-name:var(--font-body)] antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
