import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
        <div id="main" tabIndex={-1}>{children}</div>
      </body>
    </html>
  );
}
