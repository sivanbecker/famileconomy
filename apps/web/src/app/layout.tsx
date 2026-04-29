import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'

const heebo = Heebo({ subsets: ['hebrew', 'latin'], variable: '--font-heebo' })

export const metadata: Metadata = {
  title: 'Famileconomy',
  description: 'Family finance management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="min-h-screen bg-background font-[var(--font-heebo)] text-foreground antialiased">
        {children}
      </body>
    </html>
  )
}
