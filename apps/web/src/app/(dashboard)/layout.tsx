'use client'

import { useAuthStore } from '../../store/auth'
import { useAuth } from '../../hooks/use-auth'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'תמונת מצב' },
  { href: '/dashboard/import', label: 'ייבוא' },
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuth()
  const user = useAuthStore(s => s.user)

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <span className="text-muted-foreground">טוען...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col gap-1 border-s bg-muted/40 p-4">
        <p className="mb-4 text-sm font-medium text-muted-foreground">{user.name}</p>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(item => (
            <a
              key={item.href}
              href={item.href}
              className="rounded-md px-3 py-2 text-sm hover:bg-accent"
            >
              {item.label}
            </a>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  )
}
