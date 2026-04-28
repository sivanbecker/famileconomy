'use client'

import { useState } from 'react'
import { useAuthStore } from '../../../store/auth'
import { MonthNavigator } from '../../../components/month-navigator'
import { KpiCard } from '../../../components/kpi-card'

export default function DashboardPage() {
  const user = useAuthStore(s => s.user)
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
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">שלום, {user?.name}</h1>
        <MonthNavigator year={year} month={month} onPrev={handlePrev} onNext={handleNext} />
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="יתרה לבזבז" amountAgorot={0} />
        <KpiCard label="הכנסות" amountAgorot={0} />
        <KpiCard label="הוצאות" amountAgorot={0} />
        <KpiCard label="מאזן" amountAgorot={0} />
      </div>

      <section>
        <h2 className="mb-3 font-medium">עסקאות אחרונות</h2>
        <p className="text-sm text-muted-foreground">
          אין עסקאות לחודש זה. ייבא קובץ CSV כדי להתחיל.
        </p>
      </section>
    </div>
  )
}
