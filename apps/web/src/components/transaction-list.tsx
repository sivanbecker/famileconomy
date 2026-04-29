'use client'

import { formatILS } from '@famileconomy/utils'
import type { Transaction } from '../hooks/use-transactions'

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
      {category}
    </span>
  )
}

// ─── Single row ───────────────────────────────────────────────────────────────

function TransactionRow({ tx }: { tx: Transaction }) {
  const isCredit = tx.amountAgorot < 0
  const installmentLabel =
    tx.installmentNum && tx.installmentOf ? ` (${tx.installmentNum}/${tx.installmentOf})` : ''

  return (
    <li className="flex items-center justify-between gap-3 py-3 border-b border-border last:border-0">
      <div className="flex flex-col gap-1 min-w-0">
        <span className="truncate text-sm font-medium">
          {tx.description}
          {installmentLabel && (
            <span className="text-muted-foreground text-xs">{installmentLabel}</span>
          )}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{tx.transactionDate}</span>
          <CategoryBadge category={tx.category} />
        </div>
      </div>
      <span
        className={`shrink-0 text-sm font-semibold tabular-nums ${isCredit ? 'text-primary' : 'text-foreground'}`}
      >
        {formatILS(tx.amountAgorot)}
      </span>
    </li>
  )
}

// ─── List ─────────────────────────────────────────────────────────────────────

interface TransactionListProps {
  transactions: Transaction[]
  isLoading: boolean
  limit?: number
}

export function TransactionList({ transactions, isLoading, limit = 10 }: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-10 animate-pulse rounded-md bg-surface-2" />
        ))}
      </div>
    )
  }

  const visible = transactions.slice(0, limit)

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        אין עסקאות לחודש זה. ייבא קובץ CSV כדי להתחיל.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map(tx => (
        <TransactionRow key={tx.id} tx={tx} />
      ))}
    </ul>
  )
}
