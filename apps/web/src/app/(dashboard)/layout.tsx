'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
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
  Menu,
  X,
} from 'lucide-react'
import { Button } from '@famileconomy/ui'
import { useAuthStore } from '../../store/auth'
import { useAuth } from '../../hooks/use-auth'
import { apiClient } from '../../lib/api'
import { ImportModal } from '../../components/import-modal'

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
    items: [{ href: '/dashboard/recurring-payments', label: 'תשלומים קבועים', icon: CreditCard }],
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

// Bottom nav shows the 5 most-used items on mobile
const BOTTOM_NAV_ITEMS = [
  { href: '/dashboard', label: 'תמונת מצב', icon: LayoutDashboard },
  { href: '/dashboard/expenses', label: 'הוצאות', icon: TrendingDown },
  { href: '/dashboard/income', label: 'הכנסות', icon: TrendingUp },
  { href: '/dashboard/recurring', label: 'תקביע', icon: Calendar },
  { href: '/dashboard/settings', label: 'הגדרות', icon: Settings },
]

// ─── Sidebar nav content (shared between desktop sidebar + mobile drawer) ─────

function SidebarNav({
  pathname,
  onImport,
  onLogout,
  userName,
}: {
  pathname: string
  onImport: () => void
  onLogout: () => void
  userName: string
}) {
  return (
    <>
      {/* Logo */}
      <div className="flex items-center gap-2 px-4 py-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-xs font-extrabold text-primary-foreground">
          F
        </span>
        <span className="text-sm font-bold tracking-tight">Famileconomy</span>
      </div>

      {/* Import button */}
      <div className="px-3 pb-2">
        <Button className="w-full justify-start gap-2" onClick={onImport}>
          <Upload className="h-4 w-4" />
          ייבוא דוחות אשראי
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-2" aria-label="ניווט ראשי">
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
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-surface-2 hover:text-foreground'
                    }`}
                  >
                    <item.icon className="h-4 w-4 flex-shrink-0" />
                    {item.label}
                  </Link>
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
            {userName.charAt(0)}
          </span>
          <span className="flex-1 truncate text-sm font-medium">{userName}</span>
          <button
            onClick={onLogout}
            className="text-muted-foreground transition-colors hover:text-destructive"
            aria-label="התנתק"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  useAuth()
  const user = useAuthStore(s => s.user)
  const clearUser = useAuthStore(s => s.clearUser)
  const pathname = usePathname()
  const [importOpen, setImportOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)

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

  const sidebarProps = {
    pathname,
    onImport: () => {
      setImportOpen(true)
      setDrawerOpen(false)
    },
    onLogout: handleLogout,
    userName: user.name,
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ── Desktop sidebar (lg+) ── */}
      <aside className="hidden w-56 flex-shrink-0 flex-col border-s border-border bg-surface lg:flex">
        <SidebarNav {...sidebarProps} />
      </aside>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Mobile drawer panel ── */}
      <aside
        className={`fixed inset-y-0 end-0 z-50 flex w-64 flex-col border-s border-border bg-surface transition-transform duration-200 ease-out lg:hidden ${
          drawerOpen ? 'translate-x-0' : 'translate-x-full rtl:-translate-x-full'
        }`}
        aria-label="תפריט ניווט"
        aria-hidden={!drawerOpen}
      >
        <button
          className="absolute start-3 top-4 rounded-md p-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setDrawerOpen(false)}
          aria-label="סגור תפריט"
        >
          <X className="h-5 w-5" />
        </button>
        <SidebarNav {...sidebarProps} />
      </aside>

      {/* ── Main content ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
          <span className="text-sm font-bold tracking-tight">Famileconomy</span>
          <button
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground"
            onClick={() => setDrawerOpen(true)}
            aria-label="פתח תפריט"
            aria-expanded={drawerOpen}
            aria-controls="mobile-drawer"
          >
            <Menu className="h-5 w-5" />
          </button>
        </header>

        <main className="flex flex-1 flex-col overflow-hidden pb-20 lg:pb-0">{children}</main>

        {/* ── Mobile bottom nav ── */}
        <nav
          className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-surface lg:hidden"
          aria-label="ניווט תחתון"
        >
          {BOTTOM_NAV_ITEMS.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-label-xs transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                <item.icon className="h-5 w-5" />
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* ── Import modal ── */}
      <ImportModal open={importOpen} onClose={() => setImportOpen(false)} userId={user.id} />
    </div>
  )
}
