'use client'

import { ChevronRight, ChevronLeft } from 'lucide-react'
import { Button } from '@famileconomy/ui'

const HEBREW_MONTHS = [
  'ינואר',
  'פברואר',
  'מרץ',
  'אפריל',
  'מאי',
  'יוני',
  'יולי',
  'אוגוסט',
  'ספטמבר',
  'אוקטובר',
  'נובמבר',
  'דצמבר',
]

interface MonthNavigatorProps {
  year: number
  month: number
  onPrev: () => void
  onNext: () => void
}

export function MonthNavigator({ year, month, onPrev, onNext }: MonthNavigatorProps) {
  const now = new Date()
  const isCurrentOrFuture =
    year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)

  const monthName = HEBREW_MONTHS[month - 1]

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        aria-label="חודש הבא"
        onClick={onNext}
        disabled={isCurrentOrFuture}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="min-w-32 text-center font-medium">
        {monthName} {year}
      </span>
      <Button variant="ghost" size="icon" aria-label="חודש קודם" onClick={onPrev}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
