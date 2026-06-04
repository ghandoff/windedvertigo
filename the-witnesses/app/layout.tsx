import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'The Witnesses — winded.vertigo',
  description: 'A small async game where six visitors meet your seed.',
  openGraph: {
    title: 'The Witnesses',
    description: 'A small game from winded.vertigo.',
    siteName: 'winded.vertigo',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased bg-[#0a0a1a]">
        {children}
      </body>
    </html>
  );
}
