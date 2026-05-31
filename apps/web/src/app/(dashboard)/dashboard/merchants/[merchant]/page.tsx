'use client'

import { useMemo, useState, useRef, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Search,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  MessageSquare,
  Plus,
  Trash2,
  Pencil,
  Check,
  Flag,
  SlidersHorizontal,
  Star,
  ArrowRight,
  Calendar,
  TrendingDown,
  Receipt,
  BarChart2,
  TrendingUp,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatILS } from '@famileconomy/utils'
import { useAuth } from '../../../../../hooks/use-auth'
import {
  useMerchantTransactions,
  buildMerchantChartData,
} from '../../../../../hooks/use-merchant-transactions'
import {
  useTransactionNotes,
  useAddNote,
  useUpdateNote,
  useDeleteNote,
} from '../../../../../hooks/use-transaction-notes'
import { useReviewTransaction, useBulkReview } from '../../../../../hooks/use-review-transaction'
import { useSetIsMust, useBulkSetIsMust } from '../../../../../hooks/use-is-must'
import { useUpdateCategory } from '../../../../../hooks/use-expenses'
import type { TransactionNote } from '../../../../../hooks/use-transaction-notes'
import type { SortField, SortDir, ExpenseFilters } from '../../../../../hooks/use-expenses'
import type { Transaction, ReviewStatus } from '../../../../../hooks/use-transactions'

// ─── Types ────────────────────────────────────────────────────────────────────

type NotesLabel = 'הוראת קבע' | 'תשלומים' | 'אחר'
type ReviewFilter = 'USER_REVIEWED' | 'USER_FLAGGED' | 'NONE'
type YearFilter = number | null
type IsMustFilter = 'all' | 'must' | 'nice-to-have'

// ─── Constants ────────────────────────────────────────────────────────────────

const YEAR_OPTIONS: (number | null)[] = [null, 2026, 2025]

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

function classifyNotes(tx: Transaction): NotesLabel {
  if (!tx.notes) return 'אחר'
  if (tx.notes.includes('הוראת קבע')) return 'הוראת קבע'
  if (tx.installmentNum !== null) return 'תשלומים'
  return 'אחר'
}

// ─── Sort header icon ─────────────────────────────────────────────────────────

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

function NoteItem({
  note,
  userId,
  transactionId,
}: {
  note: TransactionNote
  userId: string
  transactionId: string
}) {
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

function NotesButton({ transactionId, userId }: { transactionId: string; userId: string }) {
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

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      )
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  function handleAdd() {
    if (!newBody.trim() || !userId) return
    addNote({ userId, body: newBody.trim() }, { onSuccess: () => setNewBody('') })
  }

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => setOpen(v => !v)}
        className={`rounded p-1 transition-colors ${
          hasNotes ? 'text-primary' : 'text-muted-foreground opacity-0 group-hover:opacity-100'
        } hover:bg-surface-2`}
        title="הערות"
      >
        <MessageSquare className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-label="הערות"
          className="absolute end-0 top-6 z-50 w-72 rounded-lg border border-border bg-surface shadow-lg"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">הערות</p>
          </div>
          <div className="max-h-48 overflow-y-auto px-3 py-2">
            {isLoading ? (
              <p className="py-4 text-center text-xs text-muted-foreground">טוען...</p>
            ) : notes.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">אין הערות עדיין</p>
            ) : (
              <div className="flex flex-col gap-2">
                {notes.map(note => (
                  <NoteItem
                    key={note.id}
                    note={note}
                    userId={userId}
                    transactionId={transactionId}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-border px-3 py-2">
            <div className="flex gap-2">
              <textarea
                value={newBody}
                onChange={e => setNewBody(e.target.value)}
                placeholder="הוסף הערה..."
                rows={2}
                maxLength={2000}
                className="flex-1 resize-none rounded border border-border bg-background px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleAdd()
                  }
                }}
              />
              <button
                onClick={handleAdd}
                disabled={isAdding || !newBody.trim()}
                className="rounded-md bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Filter modal ─────────────────────────────────────────────────────────────

const REVIEW_FILTER_LABELS: Record<ReviewFilter, string> = {
  USER_REVIEWED: 'נבדק ✓',
  USER_FLAGGED: 'לבדיקה נוספת 🔴',
  NONE: 'ללא סימון',
}

interface FilterModalProps {
  available: NotesLabel[]
  checked: Set<NotesLabel>
  counts: Record<NotesLabel, number>
  onToggle: (label: NotesLabel) => void
  onSelectAll: () => void
  onClear: () => void
  reviewFilters: Set<ReviewFilter>
  reviewCounts: Record<ReviewFilter, number>
  onToggleReview: (f: ReviewFilter) => void
  onSelectAllReview: () => void
  onClearReview: () => void
  isMustFilter: IsMustFilter
  onSetIsMustFilter: (f: IsMustFilter) => void
  onClose: () => void
}

function FilterModal({
  available,
  checked,
  counts,
  onToggle,
  onSelectAll,
  onClear,
  reviewFilters,
  reviewCounts,
  onToggleReview,
  onSelectAllReview,
  onClearReview,
  isMustFilter,
  onSetIsMustFilter,
  onClose,
}: FilterModalProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  const allReviewOptions: ReviewFilter[] = ['USER_REVIEWED', 'USER_FLAGGED', 'NONE']

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="פילטר"
      className="absolute start-0 top-10 z-50 w-64 rounded-lg border border-border bg-surface shadow-lg"
    >
      <div className="border-b border-border px-4 py-3">
        <p className="text-sm font-semibold">סינון לפי הערות</p>
      </div>
      <div className="flex gap-3 border-b border-border px-4 py-2 text-xs">
        <button onClick={onSelectAll} className="text-primary hover:underline">
          בחר הכל ({available.length})
        </button>
        <span className="text-border">|</span>
        <button onClick={onClear} className="text-primary hover:underline">
          נקה
        </button>
        <span className="ms-auto text-muted-foreground">מציג {checked.size}</span>
      </div>
      <div className="px-2 py-2">
        {available.map(label => (
          <label
            key={label}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={checked.has(label)}
              onChange={() => onToggle(label)}
              className="h-4 w-4 rounded accent-primary"
            />
            <span className="flex-1">{label}</span>
            <span className="tabular-nums text-xs text-muted-foreground">
              {label === 'הוראת קבע'
                ? counts['הוראת קבע']
                : label === 'תשלומים'
                  ? counts['תשלומים']
                  : counts['אחר']}
            </span>
          </label>
        ))}
        {available.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-muted-foreground">אין נתונים</p>
        )}
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="text-sm font-semibold">סטטוס בדיקה</p>
      </div>
      <div className="flex gap-3 border-b border-border px-4 py-2 text-xs">
        <button onClick={onSelectAllReview} className="text-primary hover:underline">
          בחר הכל
        </button>
        <span className="text-border">|</span>
        <button onClick={onClearReview} className="text-primary hover:underline">
          נקה
        </button>
        <span className="ms-auto text-muted-foreground">מציג {reviewFilters.size}</span>
      </div>
      <div className="px-2 py-2">
        {allReviewOptions.map(f => (
          <label
            key={f}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-2"
          >
            <input
              type="checkbox"
              checked={reviewFilters.has(f)}
              onChange={() => onToggleReview(f)}
              className="h-4 w-4 rounded accent-primary"
            />
            {/* eslint-disable-next-line security/detect-object-injection -- f is a typed ReviewFilter union, not user input */}
            <span className="flex-1">{REVIEW_FILTER_LABELS[f]}</span>
            {/* eslint-disable-next-line security/detect-object-injection -- f is a typed ReviewFilter union, not user input */}
            <span className="tabular-nums text-xs text-muted-foreground">{reviewCounts[f]}</span>
          </label>
        ))}
      </div>
      <div className="border-t border-border px-4 py-3">
        <p className="text-sm font-semibold">סיווג הוצאה</p>
      </div>
      <div className="px-2 pb-3">
        {(
          [
            { value: 'all', label: 'הכל' },
            { value: 'must', label: 'חיוני בלבד' },
            { value: 'nice-to-have', label: 'לא חיוני בלבד' },
          ] as { value: IsMustFilter; label: string }[]
        ).map(({ value, label }) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-surface-2"
          >
            <input
              type="radio"
              name="isMust-merchant"
              checked={isMustFilter === value}
              onChange={() => onSetIsMustFilter(value)}
              className="h-4 w-4 accent-primary"
            />
            <span className="flex-1">{label}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ─── Bulk action bar ──────────────────────────────────────────────────────────

interface BulkActionBarProps {
  count: number
  onMarkReviewed: () => void
  onMarkFlagged: () => void
  onClearReview: () => void
  onMarkMust: () => void
  onMarkNiceToHave: () => void
  onDeselect: () => void
  isPending: boolean
}

function BulkActionBar({
  count,
  onMarkReviewed,
  onMarkFlagged,
  onClearReview,
  onMarkMust,
  onMarkNiceToHave,
  onDeselect,
  isPending,
}: BulkActionBarProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
      <span className="font-medium text-primary">
        {count} {count === 1 ? 'עסקה נבחרה' : 'עסקאות נבחרו'}
      </span>
      <div className="ms-auto flex flex-wrap items-center gap-2">
        <button
          onClick={onMarkReviewed}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success hover:bg-success/20 disabled:opacity-50"
        >
          <Check className="h-3.5 w-3.5" />
          סמן כנבדק
        </button>
        <button
          onClick={onMarkFlagged}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/20 disabled:opacity-50"
        >
          <Flag className="h-3.5 w-3.5" />
          סמן לבדיקה
        </button>
        <button
          onClick={onClearReview}
          disabled={isPending}
          className="rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          נקה סימון
        </button>
        <span className="h-4 w-px bg-border" />
        <button
          onClick={onMarkMust}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 disabled:opacity-50"
          title="סמן כחיוני"
        >
          <Star className="h-3.5 w-3.5 fill-primary" />
          חיוני
        </button>
        <button
          onClick={onMarkNiceToHave}
          disabled={isPending}
          className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-2 hover:text-foreground disabled:opacity-50"
          title="סמן כלא חיוני"
        >
          <Star className="h-3.5 w-3.5" />
          לא חיוני
        </button>
        <button
          onClick={onDeselect}
          className="rounded p-0.5 text-muted-foreground hover:text-foreground"
          title="בטל בחירה"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

function resolveColor(varName: string): string {
  if (typeof window === 'undefined') return '#888'
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim() || '#888'
}

// ─── Chart tooltip ────────────────────────────────────────────────────────────

interface ChartTooltipProps {
  active?: boolean
  payload?: { value: number }[]
  label?: string
}

function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  const value = payload[0]?.value ?? 0
  return (
    <div className="rounded-md border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium">{label}</p>
      <p className="text-destructive">{formatILS(value)}</p>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MerchantPage() {
  const params = useParams()
  const router = useRouter()
  const rawMerchant = params['merchant']
  const merchantName = typeof rawMerchant === 'string' ? decodeURIComponent(rawMerchant) : ''

  const { user } = useAuth()
  const userId = user?.id

  const [selectedYear, setSelectedYear] = useState<YearFilter>(new Date().getFullYear())
  const [chartType, setChartType] = useState<'line' | 'bar'>('line')
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [maxAmount, setMaxAmount] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('date')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filterOpen, setFilterOpen] = useState(false)
  const [checkedNotesLabels, setCheckedNotesLabels] = useState<Set<NotesLabel> | null>(null)
  const [checkedReviewFilters, setCheckedReviewFilters] = useState<Set<ReviewFilter> | null>(null)
  const [isMustFilter, setIsMustFilter] = useState<IsMustFilter>('all')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const filters = useMemo((): ExpenseFilters => {
    const f: ExpenseFilters = { sortBy, sortDir }
    if (search) f.search = search
    if (categoryFilter) f.category = categoryFilter
    if (minAmount) f.minAmount = Number(minAmount) * 100
    if (maxAmount) f.maxAmount = Number(maxAmount) * 100
    if (isMustFilter === 'must') f.isMust = 'true'
    else if (isMustFilter === 'nice-to-have') f.isMust = 'false'
    return f
  }, [search, categoryFilter, minAmount, maxAmount, sortBy, sortDir, isMustFilter])

  const { data, isLoading, isError } = useMerchantTransactions(
    merchantName,
    selectedYear,
    filters,
    userId
  )
  const transactions = data?.transactions ?? []
  const summary = data?.summary

  const { mutate: updateCategory, isPending: isCategoryPending } = useUpdateCategory(null, 0, 0)
  const { mutate: reviewTransaction } = useReviewTransaction(null, 0, 0)
  const { mutate: bulkReview, isPending: isBulkPending } = useBulkReview(null, 0, 0)
  const { mutate: setIsMust } = useSetIsMust()
  const { mutate: bulkSetIsMust, isPending: isBulkIsMustPending } = useBulkSetIsMust()

  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    for (const tx of transactions) {
      if (tx.category) cats.add(tx.category)
    }
    return Array.from(cats).sort()
  }, [transactions])

  const { availableNotesLabels, notesCounts } = useMemo(() => {
    const standingOrders = transactions.filter(tx => classifyNotes(tx) === 'הוראת קבע').length
    const installments = transactions.filter(tx => classifyNotes(tx) === 'תשלומים').length
    const other = transactions.filter(tx => classifyNotes(tx) === 'אחר').length
    const counts: Record<NotesLabel, number> = {
      'הוראת קבע': standingOrders,
      תשלומים: installments,
      אחר: other,
    }
    const available = (['הוראת קבע', 'תשלומים', 'אחר'] as NotesLabel[]).filter(l =>
      l === 'הוראת קבע' ? standingOrders > 0 : l === 'תשלומים' ? installments > 0 : other > 0
    )
    return { availableNotesLabels: available, notesCounts: counts }
  }, [transactions])

  const reviewCounts = useMemo(
    (): Record<ReviewFilter, number> => ({
      USER_REVIEWED: transactions.filter(tx => tx.reviewStatus === 'USER_REVIEWED').length,
      USER_FLAGGED: transactions.filter(tx => tx.reviewStatus === 'USER_FLAGGED').length,
      NONE: transactions.filter(tx => tx.reviewStatus === null).length,
    }),
    [transactions]
  )

  const allReviewOptions: ReviewFilter[] = ['USER_REVIEWED', 'USER_FLAGGED', 'NONE']
  const effectiveChecked = checkedNotesLabels ?? new Set(availableNotesLabels)
  const effectiveReviewFilters = checkedReviewFilters ?? new Set(allReviewOptions)

  const displayedTransactions = useMemo(() => {
    let result = transactions
    if (checkedNotesLabels !== null)
      result = result.filter(tx => checkedNotesLabels.has(classifyNotes(tx)))
    if (checkedReviewFilters !== null) {
      result = result.filter(tx => {
        const f: ReviewFilter = tx.reviewStatus ?? 'NONE'
        return checkedReviewFilters.has(f)
      })
    }
    return result
  }, [transactions, checkedNotesLabels, checkedReviewFilters])

  const allDisplayedSelected =
    displayedTransactions.length > 0 && displayedTransactions.every(tx => selectedIds.has(tx.id))
  const someDisplayedSelected = displayedTransactions.some(tx => selectedIds.has(tx.id))

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (allDisplayedSelected) setSelectedIds(new Set())
    else setSelectedIds(new Set(displayedTransactions.map(tx => tx.id)))
  }, [allDisplayedSelected, displayedTransactions])

  function handleSort(field: SortField) {
    if (sortBy === field) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else {
      setSortBy(field)
      setSortDir('desc')
    }
  }

  function clearFilters() {
    setSearch('')
    setCategoryFilter('')
    setMinAmount('')
    setMaxAmount('')
    setCheckedNotesLabels(null)
    setCheckedReviewFilters(null)
    setIsMustFilter('all')
  }

  function handleBulkReview(reviewStatus: ReviewStatus) {
    if (!userId) return
    bulkReview(
      { userId, ids: Array.from(selectedIds), reviewStatus },
      { onSuccess: () => setSelectedIds(new Set()) }
    )
  }

  function handleBulkIsMust(isMust: boolean | null) {
    if (!userId) return
    bulkSetIsMust(
      { userId, ids: Array.from(selectedIds), isMust },
      { onSuccess: () => setSelectedIds(new Set()) }
    )
  }

  const filterActive =
    (checkedNotesLabels !== null && availableNotesLabels.some(l => !checkedNotesLabels.has(l))) ||
    (checkedReviewFilters !== null && allReviewOptions.some(f => !checkedReviewFilters.has(f))) ||
    isMustFilter !== 'all'
  const hasFilters = search || categoryFilter || minAmount || maxAmount || filterActive

  // Chart data filtered to selected year (already filtered by API, but buildMerchantChartData works on whatever is returned)
  const chartData = useMemo(() => buildMerchantChartData(data?.transactions ?? []), [data])
  const chartBars = chartData.map(d => ({ name: d.label, value: d.totalAgorot }))

  // Resolve CSS custom properties to real color strings for Recharts (oklch values need runtime resolution)
  const chartColor = resolveColor('--destructive')
  const borderColor = resolveColor('--border')

  const mustPct = useMemo(() => {
    const expenses = transactions.filter(tx => tx.amountAgorot > 0)
    const mustCount = expenses.filter(tx => tx.isMust !== false).length
    if (expenses.length === 0) return null
    return Math.round((mustCount / expenses.length) * 100)
  }, [transactions])

  const installmentCount = transactions.filter(tx => tx.installmentNum !== null).length

  return (
    <div className="flex flex-col gap-4 p-6">
      {/* ── Breadcrumb ── */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          הוצאות
        </button>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-display-sm">{merchantName}</h1>
      </div>

      {/* ── Year selector ── */}
      <div className="flex items-center gap-2">
        {YEAR_OPTIONS.map(y => (
          <button
            key={y ?? 'all'}
            onClick={() => setSelectedYear(y)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              selectedYear === y
                ? 'bg-primary text-primary-foreground'
                : 'bg-surface-2 text-muted-foreground hover:bg-surface hover:text-foreground'
            }`}
          >
            {y === null ? 'כל השנים' : y}
          </button>
        ))}
      </div>

      {/* ── Stats bar ── */}
      {summary && (
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-3 shadow-card-md">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <div>
              <p className="text-xs text-muted-foreground">סה״כ הוצאות</p>
              <p className="text-lg font-bold text-destructive">{formatILS(summary.totalAgorot)}</p>
            </div>
          </div>
          <div className="rounded-lg bg-surface px-4 py-3 shadow-card-md">
            <p className="text-xs text-muted-foreground">ממוצע חודשי</p>
            <p className="text-lg font-bold">{formatILS(summary.avgMonthlyAgorot)}</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-3 shadow-card-md">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">עסקאות</p>
              <p className="text-lg font-bold">{summary.count}</p>
            </div>
          </div>
          {summary.firstSeen && summary.lastSeen && (
            <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-3 shadow-card-md">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">טווח</p>
                <p className="text-sm font-medium">
                  {summary.firstSeen} → {summary.lastSeen}
                </p>
              </div>
            </div>
          )}
          {mustPct !== null && (
            <div className="flex items-center gap-2 rounded-lg bg-surface px-4 py-3 shadow-card-md">
              <Star className="h-4 w-4 fill-primary text-primary" />
              <div>
                <p className="text-xs text-muted-foreground">חיוני</p>
                <p className="text-lg font-bold text-primary">{mustPct}%</p>
              </div>
            </div>
          )}
          {installmentCount > 0 && (
            <div className="rounded-lg bg-surface px-4 py-3 shadow-card-md">
              <p className="text-xs text-muted-foreground">בתשלומים</p>
              <p className="text-lg font-bold">{installmentCount}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Spending chart ── */}
      {chartBars.length > 0 && (
        <div className="rounded-lg bg-surface p-4 shadow-card-md">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-muted-foreground">הוצאות לפי חודש</p>
            <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setChartType('line')}
                className={`rounded p-1.5 transition-colors ${chartType === 'line' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="גרף קו"
              >
                <TrendingUp className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setChartType('bar')}
                className={`rounded p-1.5 transition-colors ${chartType === 'bar' ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                title="גרף עמודות"
              >
                <BarChart2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            {chartType === 'line' ? (
              <LineChart data={chartBars} margin={{ top: 12, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={borderColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatILS(v).replace('₪', '').trim()}
                  width={60}
                />
                <Tooltip content={<ChartTooltip />} />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={chartColor}
                  strokeWidth={2.5}
                  dot={{ fill: chartColor, stroke: chartColor, r: 5, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: chartColor, stroke: chartColor }}
                />
              </LineChart>
            ) : (
              <BarChart data={chartBars} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={borderColor} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v: number) => formatILS(v).replace('₪', '').trim()}
                  width={60}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="value" fill={chartColor} fillOpacity={0.75} radius={[3, 3, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          onMarkReviewed={() => handleBulkReview('USER_REVIEWED')}
          onMarkFlagged={() => handleBulkReview('USER_FLAGGED')}
          onClearReview={() => handleBulkReview(null)}
          onMarkMust={() => handleBulkIsMust(null)}
          onMarkNiceToHave={() => handleBulkIsMust(false)}
          onDeselect={() => setSelectedIds(new Set())}
          isPending={isBulkPending || isBulkIsMustPending}
        />
      )}

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg bg-surface p-4 shadow-card-md">
        <div className="relative">
          <button
            onClick={() => setFilterOpen(v => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm transition-colors ${
              filterActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            פילטר
            {filterActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
          </button>
          {filterOpen && (
            <FilterModal
              available={availableNotesLabels}
              checked={effectiveChecked}
              counts={notesCounts}
              onToggle={label => {
                const next = new Set(effectiveChecked)
                if (next.has(label)) next.delete(label)
                else next.add(label)
                setCheckedNotesLabels(next)
              }}
              onSelectAll={() => setCheckedNotesLabels(new Set(availableNotesLabels))}
              onClear={() => setCheckedNotesLabels(new Set())}
              reviewFilters={effectiveReviewFilters}
              reviewCounts={reviewCounts}
              onToggleReview={f => {
                const next = new Set(effectiveReviewFilters)
                if (next.has(f)) next.delete(f)
                else next.add(f)
                setCheckedReviewFilters(next)
              }}
              onSelectAllReview={() => setCheckedReviewFilters(new Set(allReviewOptions))}
              onClearReview={() => setCheckedReviewFilters(new Set())}
              isMustFilter={isMustFilter}
              onSetIsMustFilter={setIsMustFilter}
              onClose={() => setFilterOpen(false)}
            />
          )}
        </div>
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

      {/* ── Transaction table ── */}
      <div className="overflow-x-auto rounded-lg bg-surface shadow-card-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-muted-foreground">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={allDisplayedSelected}
                  ref={el => {
                    if (el) el.indeterminate = someDisplayedSelected && !allDisplayedSelected
                  }}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded accent-primary"
                  aria-label="בחר הכל"
                />
              </th>
              <th className="px-4 py-3 text-start">
                <button
                  className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
                  onClick={() => handleSort('date')}
                >
                  תאריך <SortIcon field="date" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-start">
                <button
                  className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
                  onClick={() => handleSort('description')}
                >
                  תיאור <SortIcon field="description" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-start">
                <button
                  className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
                  onClick={() => handleSort('category')}
                >
                  קטגוריה <SortIcon field="category" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide">
                כרטיס
              </th>
              <th className="px-4 py-3 text-end">
                <button
                  className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide"
                  onClick={() => handleSort('amount')}
                >
                  סכום <SortIcon field="amount" sortBy={sortBy} sortDir={sortDir} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border/50">
                  <td className="px-4 py-3">
                    <div className="h-4 w-4 animate-pulse rounded bg-surface-2" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-20 animate-pulse rounded bg-surface-2" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-40 animate-pulse rounded bg-surface-2" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-24 animate-pulse rounded bg-surface-2" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-4 w-12 animate-pulse rounded bg-surface-2" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="ms-auto h-4 w-16 animate-pulse rounded bg-surface-2" />
                  </td>
                </tr>
              ))}
            {!isLoading && displayedTransactions.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                  {isError ? 'לא ניתן לטעון נתונים.' : 'אין עסקאות להצגה.'}
                </td>
              </tr>
            )}
            {!isLoading &&
              displayedTransactions.map(tx => {
                const isSelected = selectedIds.has(tx.id)
                const dateLabel = new Date(tx.transactionDate).toLocaleDateString('he-IL', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })

                return (
                  <tr
                    key={tx.id}
                    className={`group border-b border-border/50 transition-colors hover:bg-surface-2/50 ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(tx.id)}
                        className="h-4 w-4 rounded accent-primary"
                        aria-label={`בחר ${tx.description}`}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {dateLabel}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {tx.reviewStatus === 'USER_REVIEWED' && (
                          <button
                            onClick={() =>
                              userId &&
                              reviewTransaction({
                                transactionId: tx.id,
                                userId,
                                reviewStatus: null,
                              })
                            }
                            className="shrink-0 rounded p-0.5 text-success hover:bg-success/10"
                            title="נבדק — לחץ לביטול"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {tx.reviewStatus === 'USER_FLAGGED' && (
                          <button
                            onClick={() =>
                              userId &&
                              reviewTransaction({
                                transactionId: tx.id,
                                userId,
                                reviewStatus: null,
                              })
                            }
                            className="shrink-0 rounded p-0.5 text-destructive hover:bg-destructive/10"
                            title="לבדיקה — לחץ לביטול"
                          >
                            <Flag className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <span className="font-medium">{tx.description}</span>
                        {tx.installmentNum !== null && tx.installmentOf !== null && (
                          <span className="text-xs text-muted-foreground">
                            ({tx.installmentNum}/{tx.installmentOf})
                          </span>
                        )}
                        {tx.notes && (
                          <span className="text-xs text-muted-foreground">{tx.notes}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {userId && (
                        <CategoryCell
                          tx={tx}
                          userId={userId}
                          isPending={isCategoryPending}
                          onMutate={(id, cat, uid) =>
                            updateCategory({ transactionId: id, category: cat, userId: uid })
                          }
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
                    <td className="px-4 py-3 text-end">
                      <div className="flex items-center justify-end gap-2">
                        {tx.amountAgorot > 0 && userId && (
                          <button
                            onClick={() =>
                              setIsMust({
                                transactionId: tx.id,
                                userId,
                                isMust: tx.isMust === false ? null : false,
                              })
                            }
                            className={`rounded p-1 transition-colors opacity-0 group-hover:opacity-100 ${tx.isMust === false ? 'text-muted-foreground' : 'text-primary'}`}
                            title={tx.isMust === false ? 'לא חיוני' : 'חיוני'}
                          >
                            <Star
                              className={`h-3.5 w-3.5 ${tx.isMust !== false ? 'fill-primary' : ''}`}
                            />
                          </button>
                        )}
                        {userId && <NotesButton transactionId={tx.id} userId={userId} />}
                        <span
                          className={`font-medium tabular-nums ${tx.amountAgorot < 0 ? 'text-success' : 'text-destructive'}`}
                        >
                          {formatILS(tx.amountAgorot)}
                        </span>
                      </div>
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
