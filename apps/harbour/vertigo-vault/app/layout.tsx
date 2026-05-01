import { Inter } from "next/font/google";
import type { Metadata } from "next";
import { auth } from "@/lib/auth";
import { Providers } from "@/components/providers";
import { HarbourNav } from "@windedvertigo/auth/harbour-nav";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "vertigo.vault — winded.vertigo",
  description:
    "a curated collection of group activities, energizers, and reflective exercises designed to spark curiosity, collaboration, and creative thinking.",
  alternates: {
    canonical: "/harbour/vertigo-vault",
  },
  openGraph: {
    type: "website",
    title: "vertigo.vault — winded.vertigo",
    description:
      "a curated collection of learning activities, energizers, and reflections designed to spark curiosity, collaboration, and creative thinking.",
    url: "/harbour/vertigo-vault",
    siteName: "winded.vertigo",
    images: [{ url: "/images/logo.png", width: 512, height: 512 }],
  },
  twitter: {
    card: "summary",
    title: "vertigo.vault — winded.vertigo",
    description:
      "a curated collection of learning activities, energizers, and reflections designed to spark curiosity, collaboration, and creative thinking.",
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
      <body className="antialiased">
        <Providers>
          <HarbourNav currentApp="vertigo-vault" user={session?.user} />
          {children}

        </Providers>
      </body>
    </html>
  );
}
