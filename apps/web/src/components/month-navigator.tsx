'use client'

import { ChevronRight, Calendar } from 'lucide-react'
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

function adjacentMonth(year: number, month: number, delta: 1 | -1) {
  const date = new Date(year, month - 1 + delta, 1)
  return HEBREW_MONTHS[date.getMonth()] ?? String(date.getMonth() + 1)
}

export function MonthNavigator({ year, month, onPrev, onNext }: MonthNavigatorProps) {
  const monthName = HEBREW_MONTHS[month - 1] ?? String(month)
  const nextMonthName = adjacentMonth(year, month, 1)
  const prevMonthName = adjacentMonth(year, month, -1)

  // In RTL layout the visual reading order is: [next ›] [month label] [‹ prev]
  // ChevronRight points toward the end of the inline axis — in RTL that is
  // visually leftward, which is "back in time" (prev). Rotating 180° gives the
  // opposite arrow for "next" without importing a second icon.
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      {/* Next month: visually on the leading (right in RTL) side */}
      <Button
        variant="ghost"
        aria-label="חודש הבא"
        onClick={onNext}
        className="flex h-auto flex-col items-center gap-0.5 px-2 py-1 text-white hover:text-white/70"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
        <span className="text-xs font-bold leading-none text-white">{nextMonthName}</span>
      </Button>

      <div className="flex items-center gap-2 px-1" aria-live="polite" aria-atomic="true">
        <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <span className="min-w-28 text-center text-sm font-semibold">
          {monthName} {year}
        </span>
      </div>

      {/* Prev month: visually on the trailing (left in RTL) side */}
      <Button
        variant="ghost"
        aria-label="חודש קודם"
        onClick={onPrev}
        className="flex h-auto flex-col items-center gap-0.5 px-2 py-1 text-white hover:text-white/70"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="text-xs font-bold leading-none">{prevMonthName}</span>
      </Button>
    </div>
  )
}
