import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "vertigo vault — windedvertigo",
  description:
    "a curated collection of group activities, energizers, and reflective exercises.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
