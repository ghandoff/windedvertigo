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
  title: "raft.house — the harbour",
  description:
    "a facilitated, real-time learning platform that helps groups cross threshold concepts through play. use it to cross, then let it go.",
  alternates: {
    canonical: "/harbour/raft-house",
  },
  openGraph: {
    type: "website",
    title: "raft.house — the harbour",
    description:
      "facilitated threshold crossings — jackbox meets escape room meets socratic seminar.",
    url: "/harbour/raft-house",
    siteName: "winded.vertigo",
  },
  twitter: {
    card: "summary",
    title: "raft.house — the harbour",
    description:
      "facilitated threshold crossings — jackbox meets escape room meets socratic seminar.",
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
        <HarbourNav currentApp="raft-house" user={session?.user} />
        <main id="main">{children}</main>
        <FeedbackWidget appSlug="raft-house" />
      </body>
    </html>
  );
}
