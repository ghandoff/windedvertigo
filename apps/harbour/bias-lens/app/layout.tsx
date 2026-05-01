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
  title: "bias.lens — the harbour",
  description: "you can't see your own blind spots. or can you? a cognitive bias discovery game.",
  alternates: { canonical: "/harbour/bias-lens" },
  openGraph: {
    type: "website",
    title: "bias.lens — the harbour",
    description: "you can't see your own blind spots. or can you? a cognitive bias discovery game.",
    url: "/harbour/bias-lens",
    siteName: "winded.vertigo",
  },
};

export default async function BiasLensLayout({
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
          <HarbourNav currentApp="bias-lens" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="bias-lens" />
        <Analytics />
      </body>
    </html>
  );
}
