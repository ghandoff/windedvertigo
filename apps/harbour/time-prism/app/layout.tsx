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
  title: "time.prism — the harbour",
  description: "a historical empathy simulation. make decisions as historical actors with only the information available at the time. no hindsight, no modern morality — just genuine uncertainty.",
  alternates: { canonical: "/harbour/time-prism" },
  openGraph: {
    type: "website",
    title: "time.prism — the harbour",
    description: "a historical empathy simulation. make decisions as historical actors with only the information available at the time. no hindsight, no modern morality — just genuine uncertainty.",
    url: "/harbour/time-prism",
    siteName: "winded.vertigo",
  },
};

export default async function TimePrismLayout({
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
          <HarbourNav currentApp="time-prism" user={session?.user} />
          {children}
        </AuthSessionProvider>
        <FeedbackWidget appSlug="time-prism" />
        <Analytics />
      </body>
    </html>
  );
}
