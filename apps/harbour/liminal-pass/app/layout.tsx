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
  title: "liminal.pass — the harbour",
  description: "a meta-game about threshold concepts. experience puzzles designed to create genuine aha moments, then reflect on the transformation itself.",
  alternates: { canonical: "/harbour/liminal-pass" },
  openGraph: {
    type: "website",
    title: "liminal.pass — the harbour",
    description: "a meta-game about threshold concepts. experience puzzles designed to create genuine aha moments, then reflect on the transformation itself.",
    url: "/harbour/liminal-pass",
    siteName: "winded.vertigo",
  },
};

export default async function LiminalPassLayout({
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
          <HarbourNav currentApp="liminal-pass" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="liminal-pass" />
        <Analytics />
      </body>
    </html>
  );
}
