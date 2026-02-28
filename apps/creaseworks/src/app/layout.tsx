import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Providers from "@/components/providers";
import NavBar from "@/components/ui/nav-bar";
import Footer from "@/components/ui/footer";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  icons: {
    icon: "/favicon.ico",
  },
  title: {
    default: "creaseworks — playdates that use what you already have",
    template: "%s — creaseworks",
  },
  description:
    "simple, tested playdates for parents, teachers, and kids. notice the world around you, see possibility everywhere, and make things with whatever's on hand.",
  metadataBase: new URL("https://windedvertigo.com/reservoir/creaseworks"),
  openGraph: {
    type: "website",
    siteName: "creaseworks",
    title: "creaseworks — playdates that use what you already have",
    description:
      "simple, tested playdates for parents, teachers, and kids. notice the world around you, see possibility everywhere, and make things with whatever's on hand.",
    url: "https://windedvertigo.com/reservoir/creaseworks",
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "creaseworks — playdates that use what you already have",
    description:
      "simple, tested playdates for parents, teachers, and kids. notice the world around you, see possibility everywhere, and make things with whatever's on hand.",
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
          <a
            href="#main-content"
            className="skip-link"
          >
            skip to main content
          </a>
          <NavBar />
          <div id="main-content">
            {children}
          </div>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
