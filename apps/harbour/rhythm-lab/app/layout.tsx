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
  title: "rhythm.lab — the harbour",
  description: "a subdivision and groove explorer. build beats, layer patterns, and feel the difference between mechanical and human timing.",
  alternates: { canonical: "/harbour/rhythm-lab" },
  openGraph: {
    type: "website",
    title: "rhythm.lab — the harbour",
    description: "a subdivision and groove explorer. build beats, layer patterns, and feel the difference between mechanical and human timing.",
    url: "/harbour/rhythm-lab",
    siteName: "winded.vertigo",
  },
};

export default async function RhythmLabLayout({
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
          <HarbourNav currentApp="rhythm-lab" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="rhythm-lab" />
        <Analytics />
      </body>
    </html>
  );
}
