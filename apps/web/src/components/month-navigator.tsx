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

export function MonthNavigator({ year, month, onPrev, onNext }: MonthNavigatorProps) {
  const monthName = HEBREW_MONTHS[month - 1] ?? String(month)

  // In RTL layout the visual reading order is: [next ›] [month label] [‹ prev]
  // ChevronRight points toward the end of the inline axis — in RTL that is
  // visually leftward, which is "back in time" (prev). Rotating 180° gives the
  // opposite arrow for "next" without importing a second icon.
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      {/* Next month: visually on the leading (right in RTL) side */}
      <Button
        variant="ghost"
        size="icon"
        aria-label="חודש הבא"
        onClick={onNext}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4 rotate-180" />
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
        size="icon"
        aria-label="חודש קודם"
        onClick={onPrev}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
