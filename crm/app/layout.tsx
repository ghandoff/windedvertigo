import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { ServiceWorkerRegister } from "@/app/components/sw-register";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "w.v CRM",
  description: "winded.vertigo — relationship management",
  manifest: "/manifest.json",
  themeColor: "#1e293b",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "w.v CRM",
  },
  icons: {
    icon: "/images/icon-192.png",
    apple: "/images/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  );
}
