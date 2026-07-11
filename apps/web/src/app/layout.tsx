import type { Metadata } from 'next'
import { Hanken_Grotesk } from 'next/font/google'
import './globals.css'

const sans = Hanken_Grotesk({
  subsets: ['latin'],
  variable: '--font-hanken',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Chi Dental Lab',
  description: 'Lab Management System',
  icons: {
    icon: '/icon.png',
    apple: '/apple-icon.png',
  },
}

// Set the theme class before paint to avoid a flash. Dark is opt-in (stored
// preference only) — existing users stay on light unless they choose dark.
const themeScript = `(function(){try{if(localStorage.getItem('chidental-theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}})()`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
