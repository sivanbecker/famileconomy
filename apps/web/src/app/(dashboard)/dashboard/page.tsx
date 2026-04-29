'use client'

import { useState } from 'react'
import { Wallet, TrendingUp, TrendingDown, PiggyBank } from 'lucide-react'
import { MonthNavigator } from '../../../components/month-navigator'
import { KpiCard } from '../../../components/kpi-card'

export default function DashboardPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  function handlePrev() {
    if (month === 1) {
      setYear(y => y - 1)
      setMonth(12)
    } else {
      setMonth(m => m - 1)
    }
  }

  function handleNext() {
    if (month === 12) {
      setYear(y => y + 1)
      setMonth(1)
    } else {
      setMonth(m => m + 1)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">תמונת מצב חודשית</h1>
        <MonthNavigator year={year} month={month} onPrev={handlePrev} onNext={handleNext} />
      </div>

      {/* ── KPI row ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label="הכנסות החודש"
          sublabel="מתוכנן:"
          amountAgorot={0}
          budgetAgorot={0}
          icon={TrendingUp}
          variant="positive"
        />
        <KpiCard
          label="הוצאות החודש"
          sublabel="מתוכנן:"
          amountAgorot={0}
          budgetAgorot={0}
          icon={TrendingDown}
          variant="negative"
        />
        <KpiCard label="מאזן החודש" amountAgorot={0} icon={Wallet} variant="default" />
        <KpiCard
          label="יתרה לבזבז"
          sublabel="מעודכן להיום"
          amountAgorot={0}
          icon={PiggyBank}
          variant="highlight"
        />
      </div>

      {/* ── Charts row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex min-h-64 flex-col gap-2 rounded-lg bg-surface p-4 shadow-card-md">
          <h2 className="font-semibold">התפלגות הוצאות לפי קטגוריה</h2>
          <p className="mt-auto text-sm text-muted-foreground">ייבא עסקאות כדי לראות את הגרף.</p>
        </div>
        <div className="flex min-h-64 flex-col gap-2 rounded-lg bg-surface p-4 shadow-card-md">
          <h2 className="font-semibold">צפי להוצאות עד סוף החודש</h2>
          <p className="mt-auto text-sm text-muted-foreground">ייבא עסקאות כדי לראות את הגרף.</p>
        </div>
      </div>

      {/* ── Bottom row ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card-md">
          <h2 className="font-semibold">עסקאות אחרונות</h2>
          <p className="text-sm text-muted-foreground">
            אין עסקאות לחודש זה. ייבא קובץ CSV כדי להתחיל.
          </p>
        </div>
        <div className="flex flex-col gap-3 rounded-lg bg-surface p-4 shadow-card-md">
          <h2 className="font-semibold">תשלומים קבועים החודש</h2>
          <p className="text-sm text-muted-foreground">לא הוגדרו תשלומים קבועים.</p>
        </div>
      </div>
    </div>
  )
}
