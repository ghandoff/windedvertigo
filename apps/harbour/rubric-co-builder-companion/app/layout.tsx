import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { Wordmark } from "./_components/wordmark";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "700"],
});

export const metadata: Metadata = {
  title: "co.rubric companion — winded.vertigo",
  description:
    "a single-user worksheet that walks you through drafting a rubric for any learning artefact. free for the PRME community.",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <a href="#main" className="skip-link">
          skip to content
        </a>
        {/* min-h-screen flex on the page wrapper lets the Wordmark footer
            bottom-stick naturally without needing position: fixed. The
            individual page <main>s use flex-1 so they fill available space. */}
        <div
          id="main"
          tabIndex={-1}
          className="min-h-screen flex flex-col"
        >
          {children}
          <Wordmark />
        </div>
        <Script
          src="https://windedvertigo.com/feedback-widget.js"
          data-app-slug="co-rubric-companion"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
