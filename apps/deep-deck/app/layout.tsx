import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "deep.deck — winded.vertigo",
  description:
    "a digital card game that helps teachers and parents connect with children through conversation, play, and reflection.",
  alternates: {
    canonical: "/harbor/deep-deck",
  },
  openGraph: {
    type: "website",
    title: "deep.deck — winded.vertigo",
    description:
      "a digital card game that helps teachers and parents connect with children through conversation, play, and reflection.",
    url: "/harbor/deep-deck",
    siteName: "winded.vertigo",
    images: [{ url: "/images/logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "deep.deck — winded.vertigo",
    description:
      "a digital card game that helps teachers and parents connect with children through conversation, play, and reflection.",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <nav className="px-6 pt-4">
          <a
            href="/harbor"
            className="text-xs uppercase tracking-wider opacity-30 hover:opacity-60 transition-opacity inline-block"
          >
            &larr; harbor
          </a>
        </nav>
        <main id="main">{children}</main>
      </body>
    </html>
  );
}
