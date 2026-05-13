'use client'

import { formatILS } from '@famileconomy/utils'
import type { Transaction } from '../hooks/use-transactions'

// ─── Card color palette ───────────────────────────────────────────────────────
// Five distinct colours cycling through the design-system chart tokens.

const CARD_COLORS = [
  'bg-chart-1/15 text-chart-1 ring-chart-1/40',
  'bg-chart-2/15 text-chart-2 ring-chart-2/40',
  'bg-chart-3/15 text-chart-3 ring-chart-3/40',
  'bg-chart-4/15 text-chart-4 ring-chart-4/40',
  'bg-chart-5/15 text-chart-5 ring-chart-5/40',
] as const

function cardColorClass(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0
  }
  return CARD_COLORS[hash % CARD_COLORS.length] ?? CARD_COLORS[0]
}

// ─── Category badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null
  return (
    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground">
      {category}
    </span>
  )
}

// ─── Card badge ───────────────────────────────────────────────────────────────

function CardBadge({
  cardLastFour,
  accountName,
}: {
  cardLastFour: string | null
  accountName?: string
}) {
  const label = cardLastFour ?? accountName
  if (!label) return null
  return (
    <span
      data-card-badge
      className={`rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${cardColorClass(label)}`}
    >
      {label}
    </span>
  )
}

// ─── Single row ───────────────────────────────────────────────────────────────

function TransactionRow({ tx, accountName }: { tx: Transaction; accountName?: string }) {
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
          <CardBadge
            cardLastFour={tx.cardLastFour}
            {...(accountName !== undefined ? { accountName } : {})}
          />
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
  accountName?: string
}

export function TransactionList({
  transactions,
  isLoading,
  limit = 10,
  accountName,
}: TransactionListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-10 animate-pulse motion-reduce:animate-none rounded-md bg-surface-2"
          />
        ))}
      </div>
    )
  }

  const visible = transactions.slice(0, limit)

  if (visible.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">אין עסקאות לחודש זה. ייבא קובץ כדי להתחיל.</p>
    )
  }

  return (
    <ul className="divide-y divide-border">
      {visible.map(tx => (
        <TransactionRow
          key={tx.id}
          tx={tx}
          {...(accountName !== undefined ? { accountName } : {})}
        />
      ))}
    </ul>
  )
}
