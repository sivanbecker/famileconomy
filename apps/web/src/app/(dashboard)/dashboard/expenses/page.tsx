'use client'

import { type Dispatch, type SetStateAction, useMemo, useState, useRef, useEffect } from 'react'
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  AlertTriangle,
  AlertCircle,
  Copy,
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  Check,
} from 'lucide-react'
import { formatILS } from '@famileconomy/utils'
import { categoryBreakdown } from '@famileconomy/utils'
import { AccountSelector } from '../../../../components/account-selector'
import { MonthNavigator } from '../../../../components/month-navigator'
import { useAuth } from '../../../../hooks/use-auth'
import { useAccountStore } from '../../../../store/account'
import { useExpenses, useUpdateCategory } from '../../../../hooks/use-expenses'
import {
  useTransactionNotes,
  useAddNote,
  useUpdateNote,
  useDeleteNote,
} from '../../../../hooks/use-transaction-notes'
import type { TransactionNote } from '../../../../hooks/use-transaction-notes'
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
      aria-label={`ערוך קטגוריה: ${tx.category ?? 'ללא קטגוריה'}`}
    >
      {tx.category ?? 'ללא קטגוריה'}
    </button>
  )
}

// ─── Notes dialog ─────────────────────────────────────────────────────────────

interface NoteItemProps {
  note: TransactionNote
  userId: string
  transactionId: string
}

function NoteItem({ note, userId, transactionId }: NoteItemProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(note.body)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const { mutate: updateNote, isPending: isUpdating } = useUpdateNote(transactionId)
  const { mutate: deleteNote, isPending: isDeleting } = useDeleteNote(transactionId)

  useEffect(() => {
    if (editing) textareaRef.current?.focus()
  }, [editing])

  useEffect(() => {
    if (!editing) setDraft(note.body)
  }, [note.body, editing])

  function handleSave() {
    if (!draft.trim() || draft === note.body) {
      setEditing(false)
      setDraft(note.body)
      return
    }
    updateNote(
      { noteId: note.id, userId, body: draft.trim() },
      { onSuccess: () => setEditing(false) }
    )
  }

  const date = new Date(note.createdAt).toLocaleDateString('he-IL', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="group flex gap-2 rounded-md border border-border/50 bg-surface px-3 py-2">
      <div className="min-w-0 flex-1">
        {editing ? (
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={2}
            maxLength={2000}
            className="w-full resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSave()
              }
              if (e.key === 'Escape') {
                setEditing(false)
                setDraft(note.body)
              }
            }}
          />
        ) : (
          <p className="whitespace-pre-wrap text-xs">{note.body}</p>
        )}
        <p className="mt-0.5 text-label-xs text-muted-foreground">{date}</p>
      </div>
      <div className="flex shrink-0 items-start gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {editing ? (
          <button
            onClick={handleSave}
            disabled={isUpdating}
            className="rounded p-0.5 text-primary hover:bg-primary/10"
            title="שמור"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            title="ערוך הערה"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          onClick={() => deleteNote({ noteId: note.id, userId })}
          disabled={isDeleting}
          className="rounded p-0.5 text-muted-foreground hover:text-destructive"
          title="מחק הערה"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

interface NotesButtonProps {
  transactionId: string
  userId: string
}

function NotesButton({ transactionId, userId }: NotesButtonProps) {
  const [open, setOpen] = useState(false)
  const [newBody, setNewBody] = useState('')
  const dialogRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const { data: notes = [], isLoading } = useTransactionNotes(
    transactionId,
    open ? userId : undefined
  )
  const { mutate: addNote, isPending: isAdding } = useAddNote(transactionId)

  const hasNotes = notes.length > 0

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleAdd() {
    const trimmed = newBody.trim()
    if (!trimmed) return
    addNote(
      { userId, body: trimmed },
      {
        onSuccess: () => {
          setNewBody('')
          setOpen(false)
        },
      }
    )
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        title={hasNotes ? `${notes.length} הערות` : 'הוסף הערה'}
        className={`rounded p-0.5 transition-colors ${
          hasNotes
            ? 'text-primary'
            : 'text-muted-foreground opacity-0 hover:text-foreground group-hover:opacity-100'
        }`}
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>

      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="הערות לעסקה"
          className="absolute end-0 top-6 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-border bg-surface-2 p-3 shadow-lg"
        >
          <p className="mb-2 text-xs font-semibold text-muted-foreground">הערות</p>

          {isLoading && <div className="mb-2 h-3 w-24 animate-pulse rounded bg-surface" />}

          {notes.length > 0 && (
            <div className="mb-2 flex flex-col gap-1.5">
              {notes.map(note => (
                <NoteItem key={note.id} note={note} userId={userId} transactionId={transactionId} />
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <textarea
              autoFocus={notes.length === 0}
              value={newBody}
              onChange={e => setNewBody(e.target.value)}
              placeholder="הוסף הערה..."
              rows={2}
              maxLength={2000}
              className="min-h-[44px] flex-1 resize-none rounded border border-border bg-background px-2 py-1.5 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleAdd()
                }
                if (e.key === 'Escape') setOpen(false)
              }}
            />
            <button
              onClick={handleAdd}
              disabled={isAdding || !newBody.trim()}
              className="flex items-center gap-1 rounded bg-primary px-2 py-1.5 text-xs text-primary-foreground disabled:opacity-40"
            >
              <Plus className="h-3 w-3" />
              הוסף
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Chip state ───────────────────────────────────────────────────────────────

type ChipState = 'off' | 'highlight' | 'exclusive'

function cycleChip(set: Dispatch<SetStateAction<ChipState>>) {
  set(s => (s === 'off' ? 'highlight' : s === 'highlight' ? 'exclusive' : 'off'))
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
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false)
  const [standingOrdersChip, setStandingOrdersChip] = useState<ChipState>('off')
  const [installmentsChip, setInstallmentsChip] = useState<ChipState>('off')

  const userId = user?.id

  const filters = useMemo((): ExpenseFilters => {
    const f: ExpenseFilters = { sortBy, sortDir }
    if (search) f.search = search
    if (categoryFilter) f.category = categoryFilter
    if (minAmount) f.minAmount = Number(minAmount) * 100
    if (maxAmount) f.maxAmount = Number(maxAmount) * 100
    return f
  }, [search, categoryFilter, minAmount, maxAmount, sortBy, sortDir])

  const {
    data: transactions = [],
    isLoading,
    isError,
  } = useExpenses(activeAccountId, year, month, filters, userId)

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

  // Build set of transaction IDs that belong to a suspected-duplicate group.
  // A group = 2+ rows sharing the same date + amount + description in this month's list.
  // Both the canonical (CLEARED) and secondary (WITHIN_FILE_DUPLICATE) are included.
  const suspectedDupIds = useMemo(() => {
    const groupKey = (tx: Transaction) =>
      `${tx.transactionDate}|${tx.amountAgorot}|${tx.description}`
    const groups = new Map<string, string[]>()
    for (const tx of transactions) {
      const key = groupKey(tx)
      const group = groups.get(key) ?? []
      group.push(tx.id)
      groups.set(key, group)
    }
    const ids = new Set<string>()
    for (const group of groups.values()) {
      if (group.length >= 2) group.forEach(id => ids.add(id))
    }
    return ids
  }, [transactions])

  // Counts for notes-based filter chips
  const standingOrderCount = useMemo(
    () => transactions.filter((tx: Transaction) => tx.notes?.includes('הוראת קבע')).length,
    [transactions]
  )
  const installmentCount = useMemo(
    () => transactions.filter((tx: Transaction) => tx.installmentNum !== null).length,
    [transactions]
  )

  // Summary stats
  const stats = useMemo(() => {
    const slices = categoryBreakdown(transactions)
    const totalExpenses = slices.reduce((s, sl) => s + sl.amountAgorot, 0)
    const anomalyCount = transactions.filter((tx: Transaction) =>
      isAnomaly(tx, categoryAverages)
    ).length
    return { totalExpenses, anomalyCount, withinFileDupCount: suspectedDupIds.size }
  }, [transactions, categoryAverages, suspectedDupIds])

  // Filtered + highlighted lists
  const displayedTransactions = useMemo(() => {
    let result = transactions
    if (showDuplicatesOnly) result = result.filter((tx: Transaction) => suspectedDupIds.has(tx.id))
    if (standingOrdersChip === 'exclusive')
      result = result.filter((tx: Transaction) => tx.notes?.includes('הוראת קבע'))
    if (installmentsChip === 'exclusive')
      result = result.filter((tx: Transaction) => tx.installmentNum !== null)
    return result
  }, [transactions, showDuplicatesOnly, standingOrdersChip, installmentsChip, suspectedDupIds])

  const highlightedIds = useMemo(() => {
    const ids = new Set<string>()
    if (standingOrdersChip === 'highlight') {
      for (const tx of transactions) {
        if (tx.notes?.includes('הוראת קבע')) ids.add(tx.id)
      }
    }
    if (installmentsChip === 'highlight') {
      for (const tx of transactions) {
        if (tx.installmentNum !== null) ids.add(tx.id)
      }
    }
    return ids
  }, [transactions, standingOrdersChip, installmentsChip])

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
    setShowDuplicatesOnly(false)
    setStandingOrdersChip('off')
    setInstallmentsChip('off')
  }

  const hasFilters =
    search ||
    categoryFilter ||
    minAmount ||
    maxAmount ||
    showDuplicatesOnly ||
    standingOrdersChip !== 'off' ||
    installmentsChip !== 'off'

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* ── Top bar ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-display-sm">הוצאות</h1>
        <div className="flex items-center gap-3">
          {user && <AccountSelector userId={user.id} />}
          <MonthNavigator year={year} month={month} onPrev={handlePrev} onNext={handleNext} />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="flex flex-wrap gap-4">
        <div className="rounded-lg bg-surface px-4 py-3 shadow-card-md">
          <p className="text-xs text-muted-foreground">סה״כ הוצאות</p>
          <p className="text-lg font-bold text-destructive">{formatILS(stats.totalExpenses)}</p>
        </div>
        <div className="rounded-lg bg-surface px-4 py-3 shadow-card-md">
          <p className="text-xs text-muted-foreground">עסקאות</p>
          <p className="text-lg font-bold">{transactions.length}</p>
        </div>
        {stats.anomalyCount > 0 && (
          <div className="flex items-center gap-2 rounded-lg bg-warning/10 px-4 py-3 shadow-card-md">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <div>
              <p className="text-xs text-muted-foreground">חריגות</p>
              <p className="text-lg font-bold text-warning">{stats.anomalyCount}</p>
            </div>
          </div>
        )}
        {stats.withinFileDupCount > 0 && (
          <button
            onClick={() => setShowDuplicatesOnly(v => !v)}
            className={`flex items-center gap-2 rounded-lg px-4 py-3 shadow-card-md transition-colors ${
              showDuplicatesOnly
                ? 'bg-warning/20 ring-1 ring-warning/60'
                : 'bg-warning/10 hover:bg-warning/15'
            }`}
          >
            <Copy className="h-4 w-4 text-warning" />
            <div className="text-start">
              <p className="text-xs text-muted-foreground">כפולות חשודות</p>
              <p className="text-lg font-bold text-warning">{stats.withinFileDupCount}</p>
            </div>
          </button>
        )}
      </div>

      {/* ── Fetch error ── */}
      {isError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>לא ניתן לטעון נתונים. בדוק את החיבור לרשת ונסה שוב.</span>
        </div>
      )}

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

        {/* Amount range — full-width on mobile so it doesn't squeeze inline */}
        <div className="flex w-full items-center gap-1 sm:w-auto">
          <input
            type="number"
            placeholder="מינ׳ ₪"
            value={minAmount}
            onChange={e => setMinAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary sm:w-24"
          />
          <span className="shrink-0 text-muted-foreground">—</span>
          <input
            type="number"
            placeholder="מקס׳ ₪"
            value={maxAmount}
            onChange={e => setMaxAmount(e.target.value)}
            className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary sm:w-24"
          />
        </div>

        {/* Notes-based filter chips — off → highlight → exclusive → off */}
        {standingOrderCount > 0 && (
          <button
            onClick={() => cycleChip(setStandingOrdersChip)}
            title={
              standingOrdersChip === 'off'
                ? 'לחץ להדגשת הוראות קבע'
                : standingOrdersChip === 'highlight'
                  ? 'לחץ להצגת הוראות קבע בלבד'
                  : 'לחץ לביטול הסינון'
            }
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              standingOrdersChip === 'exclusive'
                ? 'border-primary bg-primary text-primary-foreground'
                : standingOrdersChip === 'highlight'
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {standingOrdersChip === 'exclusive'
              ? '▣'
              : standingOrdersChip === 'highlight'
                ? '●'
                : '○'}
            הוראת קבע
            <span className="tabular-nums opacity-70">{standingOrderCount}</span>
          </button>
        )}
        {installmentCount > 0 && (
          <button
            onClick={() => cycleChip(setInstallmentsChip)}
            title={
              installmentsChip === 'off'
                ? 'לחץ להדגשת תשלומים'
                : installmentsChip === 'highlight'
                  ? 'לחץ להצגת תשלומים בלבד'
                  : 'לחץ לביטול הסינון'
            }
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              installmentsChip === 'exclusive'
                ? 'border-primary bg-primary text-primary-foreground'
                : installmentsChip === 'highlight'
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            {installmentsChip === 'exclusive' ? '▣' : installmentsChip === 'highlight' ? '●' : '○'}
            תשלומים
            <span className="tabular-nums opacity-70">{installmentCount}</span>
          </button>
        )}

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
                <th className="hidden px-4 py-3 text-start sm:table-cell">
                  <button
                    className="flex items-center gap-1 hover:text-foreground"
                    onClick={() => handleSort('category')}
                  >
                    קטגוריה <SortIcon field="category" sortBy={sortBy} sortDir={sortDir} />
                  </button>
                </th>
                <th className="hidden px-4 py-3 text-start sm:table-cell">כרטיס</th>
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
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-surface-2" />
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell">
                      <div className="h-5 w-12 animate-pulse rounded-full bg-surface-2" />
                    </td>
                    <td className="px-4 py-3 text-end">
                      <div className="ms-auto h-4 w-16 animate-pulse rounded bg-surface-2" />
                    </td>
                  </tr>
                ))}

              {!isLoading && displayedTransactions.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                    {hasFilters ? 'לא נמצאו עסקאות התואמות את הסינון.' : 'אין עסקאות לחודש זה.'}
                  </td>
                </tr>
              )}

              {!isLoading &&
                displayedTransactions.map(tx => {
                  const anomaly = isAnomaly(tx, categoryAverages)
                  const isSuspectedDup = suspectedDupIds.has(tx.id)
                  const isHighlighted = highlightedIds.has(tx.id)
                  const isCredit = tx.amountAgorot < 0
                  return (
                    <tr
                      key={tx.id}
                      className={`group border-b border-border/50 transition-colors hover:bg-surface-2/50 ${
                        isHighlighted
                          ? 'border-s-2 border-s-primary bg-primary/5'
                          : isSuspectedDup || anomaly
                            ? 'bg-warning/5'
                            : ''
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                        {tx.transactionDate}
                      </td>
                      <td className="min-w-0 px-4 py-3">
                        <div className="flex items-center gap-2">
                          {isSuspectedDup && (
                            <span title="עסקה חשודה ככפולה בתוך הקובץ">
                              <Copy className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
                            </span>
                          )}
                          {anomaly && !isSuspectedDup && (
                            <span title="סכום חריג לקטגוריה זו">
                              <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 text-warning" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate font-medium sm:max-w-64">
                                {tx.description}
                              </span>
                              {tx.installmentNum !== null && tx.installmentOf !== null && (
                                <span className="text-xs text-muted-foreground">
                                  ({tx.installmentNum}/{tx.installmentOf})
                                </span>
                              )}
                            </div>
                            {tx.notes && (
                              <p className="truncate text-xs text-muted-foreground sm:max-w-64">
                                {tx.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex items-center gap-1.5">
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
                          {user && <NotesButton transactionId={tx.id} userId={user.id} />}
                        </div>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
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
