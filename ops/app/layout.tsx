import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'winded.vertigo ops dashboard',
  description: 'command center & second brain for winded.vertigo LLC',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
