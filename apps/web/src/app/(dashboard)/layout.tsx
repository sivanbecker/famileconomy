'use client'

import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  TrendingDown,
  TrendingUp,
  Calendar,
  BarChart2,
  CreditCard,
  Target,
  Settings,
  Upload,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { useAuth } from '../../hooks/use-auth'
import { apiClient } from '../../lib/api'

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV_SECTIONS = [
  {
    label: null,
    items: [{ href: '/dashboard', label: 'תמונת מצב', icon: LayoutDashboard }],
  },
  {
    label: 'ניהול',
    items: [
      { href: '/dashboard/income', label: 'הכנסות', icon: TrendingUp },
      { href: '/dashboard/expenses', label: 'הוצאות', icon: TrendingDown },
      { href: '/dashboard/recurring', label: 'תקביע', icon: Calendar },
      { href: '/dashboard/reports', label: 'דוחות', icon: BarChart2 },
    ],
  },
  {
    label: 'תשלומים',
    items: [
      { href: '/dashboard/recurring-payments', label: 'תשלומים קבועים', icon: CreditCard },
      { href: '/dashboard/import', label: 'כרטיסי אשראי', icon: Upload },
    ],
  },
  {
    label: 'עוד',
    items: [{ href: '/dashboard/goals', label: 'יעדים', icon: Target }],
  },
  {
    label: 'מערכת',
    items: [{ href: '/dashboard/settings', label: 'הגדרות', icon: Settings }],
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuth()
  const user = useAuthStore(s => s.user)
  const clearUser = useAuthStore(s => s.clearUser)
  const pathname = usePathname()

  async function handleLogout() {
    await apiClient.post('/auth/logout').catch(() => null)
    clearUser()
    window.location.href = '/login'
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="text-muted-foreground">טוען...</span>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Sidebar ── */}
      <aside className="flex w-56 flex-shrink-0 flex-col border-s border-border bg-surface">
        {/* Logo */}
        <div className="flex items-center gap-2 px-4 py-5">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-extrabold text-primary-foreground">
            F
          </span>
          <span className="text-sm font-bold tracking-tight">Famileconomy</span>
        </div>

        {/* Nav */}
        <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
          {NAV_SECTIONS.map((section, i) => (
            <div key={i}>
              {section.label && (
                <p className="mb-1 px-2 text-label-sm uppercase tracking-widest text-subtle-foreground">
                  {section.label}
                </p>
              )}
              <div className="flex flex-col gap-0.5">
                {section.items.map(item => {
                  const active = pathname === item.href
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                      }`}
                    >
                      <item.icon className="h-4 w-4 flex-shrink-0" />
                      {item.label}
                    </a>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User + logout */}
        <div className="border-t border-border px-3 py-3">
          <div className="flex items-center gap-2.5 rounded-md px-2.5 py-2">
            <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-foreground">
              {user.name.charAt(0)}
            </span>
            <span className="flex-1 truncate text-sm font-medium">{user.name}</span>
            <button
              onClick={handleLogout}
              className="text-muted-foreground transition-colors hover:text-destructive"
              aria-label="התנתק"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ── */}
      <main className="flex flex-1 flex-col overflow-hidden">{children}</main>
    </div>
  )
}
