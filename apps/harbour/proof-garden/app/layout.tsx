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
  title: "proof.garden — the harbour",
  description: "plant an axiom, grow a theorem. mathematical proof as visual play.",
  alternates: { canonical: "/harbour/proof-garden" },
  openGraph: {
    type: "website",
    title: "proof.garden — the harbour",
    description: "plant an axiom, grow a theorem. mathematical proof as visual play.",
    url: "/harbour/proof-garden",
    siteName: "winded.vertigo",
  },
};

export default async function ProofGardenLayout({
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
          <HarbourNav currentApp="proof-garden" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="proof-garden" />
        <Analytics />
      </body>
    </html>
  );
}
