'use client'

import { ChevronRight, ChevronLeft, Calendar } from 'lucide-react'
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
  const monthName = HEBREW_MONTHS[month - 1]

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <Button
        variant="ghost"
        size="icon"
        aria-label="חודש הבא"
        onClick={onNext}
        className="h-7 w-7 text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 px-1">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="min-w-28 text-center text-sm font-semibold">
          {monthName} {year}
        </span>
      </div>
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
