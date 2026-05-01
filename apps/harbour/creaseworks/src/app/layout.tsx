import type { Metadata, Viewport } from "next";
import { Inter, Atkinson_Hyperlegible, Nunito, Fraunces } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";
import Providers from "@/components/providers";
import NavBar from "@/components/ui/nav-bar";
import Footer from "@/components/ui/footer";
import { auth } from "@/lib/auth";
import { HarbourNav } from "@windedvertigo/auth/harbour-nav";
import { FeedbackWidget } from "@windedvertigo/feedback";
import { CharacterVariantProvider } from "@windedvertigo/characters/variant-context";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

const atkinson = Atkinson_Hyperlegible({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-atkinson",
  weight: ["400", "700"],
});

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800"],
});

/* display serif — warm variable font with WONK axis (playfulness 0–1).
   kid mode: WONK 0.65 via --wf-wonk CSS var; grownup: 0 (straight).
   Applied only to large headings; body stays Inter, tiles stay Nunito. */
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["WONK"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#273248",
};

export const metadata: Metadata = {
  manifest: "/harbour/creaseworks/manifest.json",
  icons: {
    icon: "/favicon.ico",
    apple: "/harbour/creaseworks/images/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "creaseworks",
  },
  title: {
    default: "creaseworks — playdates that use what you already have",
    template: "%s — creaseworks",
  },
  description:
    "simple, tested playdates for parents, teachers, and kids. notice the world around you, see possibility everywhere, and make things with whatever's on hand.",
  metadataBase: new URL("https://windedvertigo.com/harbour/creaseworks"),
  openGraph: {
    type: "website",
    siteName: "creaseworks",
    title: "creaseworks — playdates that use what you already have",
    description:
      "simple, tested playdates for parents, teachers, and kids. notice the world around you, see possibility everywhere, and make things with whatever's on hand.",
    url: "https://windedvertigo.com/harbour/creaseworks",
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const session = await auth();
  const reduceMotion = cookieStore.get("cw-reduce-motion")?.value === "true";
  const dyslexiaFont = cookieStore.get("cw-dyslexia-font")?.value === "true";
  const calmTheme = cookieStore.get("cw-calm-theme")?.value === "true";
  const uiTier = cookieStore.get("cw-ui-tier")?.value || "casual";
  // ui mode — kid is product default; grownup only applies when the
  // user has explicitly flipped the toggle in /profile accessibility.
  const grownupMode = cookieStore.get("cw-ui-mode")?.value === "grownup";
  const htmlClasses = [
    inter.variable,
    atkinson.variable,
    nunito.variable,
    fraunces.variable,
    reduceMotion && "reduce-motion",
    dyslexiaFont && "dyslexia-font",
    calmTheme && "calm-theme",
    grownupMode && "grownup-mode",
    `tier-${uiTier}`,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <html lang="en" className={htmlClasses}>
      <body className="antialiased pt-12">
        <Providers>
          <CharacterVariantProvider
            variant={grownupMode ? "adult" : "kid"}
          >
            <a
              href="#main-content"
              className="skip-link"
            >
              skip to main content
            </a>
            <HarbourNav currentApp="creaseworks" user={session?.user} />
            <NavBar />
            <div id="main-content">
              {children}
            </div>
            <Footer />
            <FeedbackWidget appSlug="creaseworks" />
          </CharacterVariantProvider>
        </Providers>
      </body>
    </html>
  );
}
