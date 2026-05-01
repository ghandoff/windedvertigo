import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { auth } from "@/lib/auth";
import AuthSessionProvider from "@/components/session-provider";
import { FeedbackWidget } from "@windedvertigo/feedback";
import { HarbourNav } from "@windedvertigo/auth/harbour-nav";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "pattern.weave — the harbour",
  description: "a gestalt perception game that trains you to see hidden patterns, reverse figure-ground relationships, and discover how your mind organises visual information.",
  alternates: { canonical: "/harbour/pattern-weave" },
  openGraph: {
    type: "website",
    title: "pattern.weave — the harbour",
    description: "a gestalt perception game that trains you to see hidden patterns, reverse figure-ground relationships, and discover how your mind organises visual information.",
    url: "/harbour/pattern-weave",
    siteName: "winded.vertigo",
  },
};

export default async function PatternWeaveLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--wv-cadet)] text-[var(--color-text-on-dark)] font-[family-name:var(--font-body)] antialiased">
        <AuthSessionProvider>
          <a href="#main" className="skip-link">skip to content</a>
          <HarbourNav currentApp="pattern-weave" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="pattern-weave" />
        <Analytics />
      </body>
    </html>
  );
}
