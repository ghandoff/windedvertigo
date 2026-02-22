import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import NavBar from "@/components/ui/nav-bar";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "creaseworks — co-design patterns for people who make things together",
    template: "%s — creaseworks",
  },
  description:
    "a library of facilitation patterns — tested scripts, materials lists, and guided prompts that help you run creative workshops with confidence.",
  metadataBase: new URL("https://creaseworks.windedvertigo.com"),
  openGraph: {
    type: "website",
    siteName: "creaseworks",
    title: "creaseworks — co-design patterns for people who make things together",
    description:
      "a library of facilitation patterns — tested scripts, materials lists, and guided prompts that help you run creative workshops with confidence.",
    url: "https://creaseworks.windedvertigo.com",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "creaseworks — co-design patterns for people who make things together",
    description:
      "a library of facilitation patterns — tested scripts, materials lists, and guided prompts that help you run creative workshops with confidence.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased pt-12">
        <Providers>
          <NavBar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
