import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { auth } from "@/lib/auth";
import AuthSessionProvider from "@/components/session-provider";
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
  title: "paper.trail — the harbour",
  description:
    "a physical-digital bridge. follow hands-on activities, capture your work with your camera, and annotate what you discover.",
  alternates: { canonical: "/harbour/paper-trail" },
  openGraph: {
    type: "website",
    title: "paper.trail — the harbour",
    description:
      "find, fold, unfold, find again. a hands-on toolkit from winded.vertigo that bridges physical making and digital reflection.",
    url: "/harbour/paper-trail",
    siteName: "winded.vertigo",
  },
};

export default async function PaperTrailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--wv-cadet)] text-[var(--color-text-on-dark)] font-[family-name:var(--font-body)] antialiased">
        <AuthSessionProvider>
          <a href="#main" className="skip-link">
            skip to content
          </a>
          <HarbourNav currentApp="paper-trail" user={session?.user} />
          {children}
          <FeedbackWidget appSlug="paper-trail" />
        </AuthSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
