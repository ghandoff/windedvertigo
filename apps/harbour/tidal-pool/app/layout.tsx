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

export default async function TidalPoolLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[var(--wv-cadet)] text-[var(--color-text-on-dark)] font-[family-name:var(--font-body)] antialiased flex flex-col h-screen">
        <AuthSessionProvider>
          <a href="#main" className="skip-link">
            skip to content
          </a>
          <HarbourNav currentApp="tidal-pool" user={session?.user} />
          {children}
          <FeedbackWidget appSlug="tidal-pool" />
        </AuthSessionProvider>
        <Analytics />
      </body>
    </html>
  );
}
