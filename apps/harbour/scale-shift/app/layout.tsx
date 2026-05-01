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
  title: "scale.shift — the harbour",
  description: "zoom in until atoms. zoom out until galaxies. you're in between.",
  alternates: { canonical: "/harbour/scale-shift" },
  openGraph: {
    type: "website",
    title: "scale.shift — the harbour",
    description: "zoom in until atoms. zoom out until galaxies. you're in between.",
    url: "/harbour/scale-shift",
    siteName: "winded.vertigo",
  },
};

export default async function ScaleShiftLayout({
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
          <HarbourNav currentApp="scale-shift" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="scale-shift" />
        <Analytics />
      </body>
    </html>
  );
}
