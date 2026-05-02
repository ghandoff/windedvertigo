import './globals.css';

export const metadata = {
  title: 'Nordic Research Platform',
  description: 'Claim substantiation, study review, and label intake for Nordic Naturals research.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
