import type { Metadata } from "next";
import { Providers } from "@/components/providers";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://windedvertigo.com"),
  title: "vertigo.vault — winded.vertigo",
  description:
    "a curated collection of group activities, energizers, and reflective exercises designed to spark curiosity, collaboration, and creative thinking.",
  alternates: {
    canonical: "/reservoir/vertigo-vault",
  },
  openGraph: {
    type: "website",
    title: "vertigo.vault — winded.vertigo",
    description:
      "a curated collection of learning activities, energizers, and reflections designed to spark curiosity, collaboration, and creative thinking.",
    url: "/reservoir/vertigo-vault",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
