import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import { Providers } from '../components/providers'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
  // next/font defaults to 'optional' for zero layout shift — correct for RTL
  // Hebrew text where Heebo vs system fallback shape difference is minimal.
})

export const metadata: Metadata = {
  title: 'Famileconomy',
  description: 'Family finance management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
