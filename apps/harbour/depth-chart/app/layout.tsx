import { Inter } from "next/font/google";
import type { Metadata } from "next";
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
  title: {
    template: "%s — depth.chart",
    default: "depth.chart — formative assessment task generator",
  },
  description:
    "generate methodologically sound formative assessment tasks from lesson plans and syllabi, grounded in constructive alignment and evaluative judgment theory.",
  alternates: {
    canonical: "/depth-chart",
  },
  openGraph: {
    type: "website",
    title: "depth.chart — formative assessment task generator",
    description:
      "generate methodologically sound formative assessment tasks from lesson plans and syllabi.",
    url: "/depth-chart",
    siteName: "winded.vertigo",
    images: [{ url: "/images/logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "depth.chart — formative assessment task generator",
    description:
      "generate methodologically sound formative assessment tasks from lesson plans and syllabi.",
    images: ["/images/logo.png"],
  },
  icons: {
    icon: [
      { url: "/images/favicon.ico", type: "image/x-icon" },
      { url: "/images/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/images/favicon-16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: [{ url: "/images/apple-touch-icon.png", sizes: "180x180" }],
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
      <body className="bg-[var(--wv-cadet)] text-[var(--color-text-on-dark)] font-[family-name:var(--font-body)] antialiased">
        <AuthSessionProvider>
          <a href="#main" className="skip-link">
            skip to content
          </a>
          <HarbourNav currentApp="depth-chart" user={session?.user} />
          {children}
          <FeedbackWidget appSlug="depth-chart" />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
