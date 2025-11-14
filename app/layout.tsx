import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Polaroid A4 Sheet (Caption Rotated)',
  description: 'Generate Polaroid-style A4 sheets with rotated captions',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}

