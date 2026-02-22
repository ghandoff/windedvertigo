import './globals.css';

export const metadata = {
  title: 'SQR-RCT Platform — Nordic Naturals',
  description: 'Study Quality Rubric for Randomized Controlled Trials.',
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
