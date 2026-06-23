import type { Metadata } from 'next'
import { Fraunces, Hanken_Grotesk } from 'next/font/google'
import './globals.css'

// "Warm clinical editorial" type system: a characterful old-style serif for
// page titles + hero numbers, a clean humanist grotesque for everything
// functional. Exposed as CSS variables consumed by globals.css @theme tokens.
const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-fraunces',
  display: 'swap',
})

const sans = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Chi Dental Lab',
  description: 'Lab Management System',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  )
}
