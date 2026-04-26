import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Famileconomy',
  description: 'Family finance management',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  )
}
