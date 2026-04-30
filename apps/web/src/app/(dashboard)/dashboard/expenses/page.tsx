'use client'

import { useMemo, useState } from 'react'
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown, AlertTriangle } from 'lucide-react'
import { formatILS } from '@famileconomy/utils'
import { categoryBreakdown } from '@famileconomy/utils'
import { AccountSelector } from '../../../../components/account-selector'
import { MonthNavigator } from '../../../../components/month-navigator'
import { useAuth } from '../../../../hooks/use-auth'
import { useAccountStore } from '../../../../store/account'
import { useExpenses, useUpdateCategory } from '../../../../hooks/use-expenses'
import type { SortField, SortDir, ExpenseFilters } from '../../../../hooks/use-expenses'
import type { Transaction } from '../../../../hooks/use-transactions'

// ─── Anomaly detection ────────────────────────────────────────────────────────

function buildCategoryAverages(transactions: Transaction[]): Map<string, number> {
  const totals = new Map<string, { sum: number; count: number }>()
  for (const tx of transactions) {
    if (tx.amountAgorot <= 0) continue
    const key = tx.category ?? 'אחר'
    const prev = totals.get(key) ?? { sum: 0, count: 0 }
    totals.set(key, { sum: prev.sum + tx.amountAgorot, count: prev.count + 1 })
  }
  const averages = new Map<string, number>()
  for (const [cat, { sum, count }] of totals) {
    averages.set(cat, sum / count)
  }
  return averages
}

function isAnomaly(tx: Transaction, averages: Map<string, number>): boolean {
  if (tx.amountAgorot <= 0) return false
  const key = tx.category ?? 'אחר'
  const avg = averages.get(key)
  if (avg === undefined || avg === 0) return false
  return tx.amountAgorot > avg * 2
}

// ─── Card badge colors ────────────────────────────────────────────────────────

const BADGE_COLORS = [
  'bg-chart-1/20 text-chart-1',
  'bg-chart-2/20 text-chart-2',
  'bg-chart-3/20 text-chart-3',
  'bg-chart-4/20 text-chart-4',
  'bg-chart-5/20 text-chart-5',
]

function cardColor(cardLastFour: string | null): string {
  if (!cardLastFour) return 'bg-surface-2 text-muted-foreground'
  let h = 0
  for (let i = 0; i < cardLastFour.length; i++) h = (h * 31 + cardLastFour.charCodeAt(i)) | 0
  const fallback = 'bg-surface-2 text-muted-foreground'
  return BADGE_COLORS[Math.abs(h) % BADGE_COLORS.length] ?? fallback
}

// ─── Sort header ──────────────────────────────────────────────────────────────

function SortIcon({
  field,
  sortBy,
  sortDir,
}: {
  field: SortField
  sortBy: SortField
  sortDir: SortDir
}) {
  if (sortBy !== field) return <ChevronsUpDown className="h-3 w-3 opacity-40" />
  return sortDir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
}

// ─── Category edit cell ───────────────────────────────────────────────────────

const CATEGORIES = [
  'מזון ומשקאות',
  'תחבורה',
  'מסעדות',
  'בידור',
  'רפואה ובריאות',
  'ביגוד ואופנה',
  'טיפוח ויופי',
  'חינוך',
  'ריהוט ובית',
  'אנרגיה',
  'תקשורת',
  'ביטוח',
  'מוסדות',
  'שונות',
  'אחר',
]

interface CategoryCellProps {
  tx: Transaction
  userId: string
  onMutate: (transactionId: string, category: string | null, userId: string) => void
  isPending: boolean
}

function CategoryCell({ tx, userId, onMutate, isPending }: CategoryCellProps) {
  const [editing, setEditing] = useState(false)

  if (editing) {
    return (
      <select
        autoFocus
        className="rounded border border-border bg-surface px-1 py-0.5 text-xs"
        defaultValue={tx.category ?? ''}
        disabled={isPending}
        onBlur={() => setEditing(false)}
        onChange={e => {
          const val = e.target.value || null
          onMutate(tx.id, val, userId)
          setEditing(false)
        }}
      >
        <option value="">ללא קטגוריה</option>
        {CATEGORIES.map(c => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
      onClick={() => setEditing(true)}
      title="לחץ לעריכת קטגוריה"
    >
      {tx.category ?? 'ללא קטגוריה'}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExpensesPage() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)

  const { user } = useAuth()
  const { activeAccountId } = useAccountStore()

  // Filters state
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const userId = user?.id

  const filters = useMemo((): ExpenseFilters => {
    const f: ExpenseFilters = { sortBy, sortDir }
    if (search) f.search = search
    if (categoryFilter) f.category = categoryFilter
    if (minAmount) f.minAmount = Number(minAmount) * 100
    if (maxAmount) f.maxAmount = Number(maxAmount) * 100
    return f
  }, [search, categoryFilter, minAmount, maxAmount, sortBy, sortDir])

  const { data: transactions = [], isLoading } = useExpenses(
    activeAccountId,
    year,
    month,
    filters,
    userId
  )

  const { mutate: updateCategory, isPending: isCategoryPending } = useUpdateCategory(
    activeAccountId,
    year,
    month
  )

  // Derive category averages for anomaly detection from unfiltered view
  // (we use the same filtered list here — good enough for MVP)
  const categoryAverages = useMemo(() => buildCategoryAverages(transactions), [transactions])

  // Derive category list for filter dropdown
  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const tx of transactions) {
      if (tx.category) cats.add(tx.category)
    }
    return Array.from(cats).sort()
  }, [transactions])

  // Summary stats
  const stats = useMemo(() => {
    const slices = categoryBreakdown(transactions)
    const totalExpenses = slices.reduce((s, sl) => s + sl.amountAgorot, 0)
    const anomalyCount = transactions.filter((tx: Transaction) =>
      isAnomaly(tx, categoryAverages)
    ).length
    return { totalExpenses, anomalyCount }
  }, [transactions, categoryAverages])

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d: SortDir) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  function handlePrev() {
    if (month === 1) {
      setYear(y => y - 1)
      setMonth(12)
    } else setMonth(m => m - 1)
  }
  function handleNext() {
    if (month === 12) {
      setYear(y => y + 1)
      setMonth(1)
    } else setMonth(m => m + 1)
  }

  function clearFilters() {
    setSearch('')
    setCategoryFilter('')
    setMinAmount('')
    setMaxAmount('')
  }

  const hasFilters = search || categoryFilter || minAmount || maxAmount

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-lg font-bold">הוצאות</h1>
        <div className="flex items-center gap-3">
          {user && <AccountSelector userId={user.id} />}
          <MonthNavigator year={year} month={month} onPrev={handlePrev} onNext={handleNext} />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex gap-4">
        <div className="rounded-lg bg-surface px-4 py-3 shadow-card-md">
          <p className="text-xs text-muted-foreground">סה״כ הוצאות</p>
          <p className="text-lg font-bold text-destructive">{formatILS(stats.totalExpenses)}</p>
        </div>
        <div className="rounded-lg bg-surface px-4 py-3 shadow-card-md">
          <p className="text-xs text-muted-foreground">עסקאות</p>
          <p className="text-lg font-bold">{transactions.length}</p>
        </div>
        {stats.anomalyCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-yellow-500/10 px-4 py-3 shadow-card-md">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <div>
              <p className="text-xs text-muted-foreground">חריגות</p>
              <p className="text-lg font-bold text-yellow-500">{stats.anomalyCount}</p>
            </div>
          </div>
        )}
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surface p-4 shadow-card-md">
        {/* Search */}
        <div className="relative min-w-48 flex-1">
          <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="חיפוש תיאור..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-md border border-border bg-background py-1.5 pe-3 ps-8 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Category */}
        <select
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
          className="rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="">כל הקטגוריות</option>
          {availableCategories.map(c => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Amount range */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            placeholder="מינ׳ ₪"
            value={minAmount}
            onChange={e => setMinAmount(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="number"
            placeholder="מקס׳ ₪"
            value={maxAmount}
            onChange={e => setMaxAmount(e.target.value)}
            className="w-24 rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
            נקה
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-lg bg-surface shadow-card-md">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-muted-foreground">
                <th className="px-4 py-3 text-start">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('date')}
                  >
                    תאריך <SortIcon field="date" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 text-start">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('description')}
                  >
                    תיאור <SortIcon field="description" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 text-start">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('category')}
                  >
                    קטגוריה <SortIcon field="category" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </th>
                <th className="px-4 py-3 text-start">כרטיס</th>
                <th className="px-4 py-3 text-end">
                  <button
                    className="flex items-center gap-1 hover:text-foreground ms-auto"
                    onClick={() => handleSort('amount')}
                  >
                    <SortIcon field="amount" sortBy={sortBy} sortDir={sortDir} /> סכום
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="px-4 py-3">
                      <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-surface-2" />
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-5 w-12 animate-pulse rounded-full bg-surface-2" />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="ms-auto h-4 w-16 animate-pulse rounded bg-surface-2" />
                    </td>
                  </tr>
                ))}

              {!isLoading && transactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {hasFilters ? 'לא נמצאו עסקאות התואמות את הסינון.' : 'אין עסקאות לחודש זה.'}
                  </td>
                </tr>
              )}

              {!isLoading &&
                transactions.map(tx => {
                  const anomaly = isAnomaly(tx, categoryAverages)
                  const isCredit = tx.amountAgorot < 0
                  return (
                    <tr
                      key={tx.id}
                      className={`border-b border-border/50 transition-colors hover:bg-surface-2/50 ${
                        anomaly ? 'bg-yellow-500/5' : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {tx.transactionDate}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {anomaly && (
                            <span title="סכום חריג לקטגוריה זו">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-yellow-500" />
                            </span>
                          )}
                          <span className="max-w-64 truncate font-medium">{tx.description}</span>
                          {tx.installmentNum !== null && tx.installmentOf !== null && (
                            <span className="text-xs text-muted-foreground">
                              ({tx.installmentNum}/{tx.installmentOf})
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {user && (
                          <CategoryCell
                            tx={tx}
                            userId={user.id}
                            onMutate={(id, cat, uid) =>
                              updateCategory({ transactionId: id, category: cat, userId: uid })
                            }
                            isPending={isCategoryPending}
                          />
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {tx.cardLastFour && (
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${cardColor(tx.cardLastFour)}`}
                          >
                            {tx.cardLastFour}
                          </span>
                        )}
                      </td>
                      <td
                        className={`whitespace-nowrap px-4 py-3 text-end font-medium tabular-nums ${
                          isCredit ? 'text-primary' : ''
                        }`}
                      >
                        {formatILS(Math.abs(tx.amountAgorot))}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
