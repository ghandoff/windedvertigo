import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "w.v. CRM",
  description: "Winded Vertigo — relationship management",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
