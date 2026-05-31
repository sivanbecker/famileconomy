'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Plus, X, Store, Tag, Loader2, ChevronLeft } from 'lucide-react'
import { useAuth } from '../../../../hooks/use-auth'
import {
  useMerchantBuckets,
  useCreateMerchantBucket,
  useSearchDescriptions,
} from '../../../../hooks/use-merchant-bucket'

// ─── Create bucket panel ──────────────────────────────────────────────────────

function CreateBucketPanel({
  userId,
  onCreated,
}: {
  userId: string
  onCreated: (bucketId: string) => void
}) {
  const [name, setName] = useState('')
  const [descQuery, setDescQuery] = useState('')
  const [selectedDescs, setSelectedDescs] = useState<string[]>([])
  const searchRef = useRef<HTMLDivElement>(null)
  const [searchOpen, setSearchOpen] = useState(false)

  const { data: results = [], isFetching } = useSearchDescriptions(userId, descQuery)
  const { mutate: createBucket, isPending } = useCreateMerchantBucket()

  const selectedSet = new Set(selectedDescs)
  const filteredResults = results.filter(d => !selectedSet.has(d))

  useEffect(() => {
    if (!searchOpen) return
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [searchOpen])

  function handleCreate() {
    if (!name.trim() || selectedDescs.length === 0) return
    createBucket(
      { userId, name: name.trim(), descriptions: selectedDescs },
      { onSuccess: bucket => onCreated(bucket.id) }
    )
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card-md">
      <p className="mb-4 text-sm font-semibold">צור קבוצת מוכרים חדשה</p>

      {/* Bucket name */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-muted-foreground">שם הקבוצה</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder='למשל: "ביטוח רכב"'
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          onKeyDown={e => {
            if (e.key === 'Enter') handleCreate()
          }}
        />
      </div>

      {/* Description picker */}
      <div className="mb-4">
        <label className="mb-1 block text-xs text-muted-foreground">
          תיאורים ({selectedDescs.length} נבחרו)
        </label>

        {/* Selected chips */}
        {selectedDescs.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1.5">
            {selectedDescs.map(desc => (
              <span
                key={desc}
                className="flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
              >
                {desc}
                <button
                  onClick={() => setSelectedDescs(prev => prev.filter(d => d !== desc))}
                  className="hover:text-destructive"
                  title="הסר"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search input */}
        <div className="relative" ref={searchRef}>
          <Search className="absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={descQuery}
            onChange={e => {
              setDescQuery(e.target.value)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            placeholder="חפש תיאור מוכר..."
            className="w-full rounded-md border border-border bg-background py-2 pe-3 ps-8 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {isFetching && (
            <Loader2 className="absolute end-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          {searchOpen && (filteredResults.length > 0 || descQuery.length >= 2) && (
            <div className="absolute start-0 top-full z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-border bg-surface shadow-lg">
              {filteredResults.length === 0 && !isFetching && (
                <p className="px-4 py-3 text-xs text-muted-foreground">לא נמצאו תיאורים תואמים</p>
              )}
              {filteredResults.map(desc => (
                <button
                  key={desc}
                  onClick={() => {
                    setSelectedDescs(prev => [...prev, desc])
                    setDescQuery('')
                    setSearchOpen(false)
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2.5 text-start text-xs hover:bg-surface-2"
                >
                  <Plus className="h-3 w-3 shrink-0 text-primary" />
                  <span className="truncate">{desc}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">הקלד לפחות 2 תווים לחיפוש בעסקאותיך</p>
      </div>

      <button
        onClick={handleCreate}
        disabled={isPending || !name.trim() || selectedDescs.length === 0}
        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        צור קבוצה
      </button>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function MerchantBucketsPage() {
  const router = useRouter()
  const { user } = useAuth()
  const userId = user?.id

  const [showCreate, setShowCreate] = useState(false)

  const { data: buckets = [], isLoading } = useMerchantBuckets(userId)

  function handleCreated(bucketId: string) {
    router.push(`/dashboard/merchants/${bucketId}`)
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display-sm">מוכרים</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            קבוצות מוכרים — אגד כמה תיאורים תחת שם אחד
          </p>
        </div>
        <button
          onClick={() => setShowCreate(v => !v)}
          className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
            showCreate
              ? 'bg-surface-2 text-foreground'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          }`}
        >
          {showCreate ? (
            <>
              <X className="h-4 w-4" />
              ביטול
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" />
              קבוצה חדשה
            </>
          )}
        </button>
      </div>

      {/* ── Create panel ── */}
      {showCreate && userId && <CreateBucketPanel userId={userId} onCreated={handleCreated} />}

      {/* ── Bucket list ── */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && buckets.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-border py-16 text-center">
          <Store className="h-10 w-10 text-muted-foreground/40" />
          <div>
            <p className="text-sm font-medium">אין קבוצות מוכרים עדיין</p>
            <p className="mt-1 text-xs text-muted-foreground">
              לחץ &quot;קבוצה חדשה&quot; כדי ליצור, או לחץ-ימני על עסקה בדף ההוצאות
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            צור קבוצה ראשונה
          </button>
        </div>
      )}

      {!isLoading && buckets.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {buckets.map(bucket => (
            <button
              key={bucket.id}
              onClick={() => router.push(`/dashboard/merchants/${bucket.id}`)}
              className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 text-start shadow-card-md transition-colors hover:border-primary/50 hover:bg-surface-2/50"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="font-semibold">{bucket.name}</span>
                </div>
                <ChevronLeft className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 rtl:rotate-180" />
              </div>

              {/* Description chips */}
              <div className="flex flex-wrap gap-1">
                {bucket.descriptions.slice(0, 3).map(desc => (
                  <span
                    key={desc}
                    className="flex items-center gap-1 rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground border border-border/60"
                  >
                    <Tag className="h-2.5 w-2.5 shrink-0" />
                    <span className="max-w-[12rem] truncate">{desc}</span>
                  </span>
                ))}
                {bucket.descriptions.length > 3 && (
                  <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground border border-border/60">
                    +{bucket.descriptions.length - 3}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{bucket.descriptions.length} תיאורים</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
