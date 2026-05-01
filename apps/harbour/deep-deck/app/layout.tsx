import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { HarbourNav } from "@windedvertigo/auth/harbour-nav";
import { FeedbackWidget } from "@windedvertigo/feedback";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "deep.deck — the harbour",
  description:
    "a digital card game that helps teachers and parents connect with children through conversation, play, and reflection.",
  alternates: {
    canonical: "/harbour/deep-deck",
  },
  openGraph: {
    type: "website",
    title: "deep.deck — the harbour",
    description:
      "a digital card game that helps teachers and parents connect with children through conversation, play, and reflection.",
    url: "/harbour/deep-deck",
    siteName: "the harbour",
    images: [{ url: "/images/logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "deep.deck — the harbour",
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <a href="#main" className="skip-link">
          skip to content
        </a>
        <HarbourNav currentApp="deep-deck" user={session?.user} />
        <main id="main">{children}</main>
        <FeedbackWidget appSlug="deep-deck" />
      </body>
    </html>
  );
}
