'use client'

import { useRef, useState } from 'react'
import axios from 'axios'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@famileconomy/ui'
import { Button, Input } from '@famileconomy/ui'
import { Upload, AlertCircle, Loader2, CheckCircle2, FolderOpen } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useAuth } from '../hooks/use-auth'
import { toast } from './toast'
import { formatBankDate, formatILS } from '@famileconomy/utils'
import {
  useBatchImport,
  filterFilesForFolder,
  type Provider,
  type BatchPhase,
} from '../hooks/use-batch-import'

// ─── Types ────────────────────────────────────────────────────────────────────

type FileFormat = 'xlsx' | 'csv'
type ImportMode = 'single' | 'folder'

interface DuplicateRecord {
  date: string
  amountAgorot: number
  description: string
  originalImportedFrom: string | null
}

interface ImportResult {
  inserted: number
  duplicates: number
  withinFileDuplicates: number
  pendingSkipped: number
  errors: string[]
  skippedRows: DuplicateRecord[]
}

interface ImportModalProps {
  open: boolean
  onClose: () => void
  userId: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function completedCount(entries: { status: string }[]): number {
  return entries.filter(e => e.status !== 'pending').length
}

function isActiveBatchPhase(phase: BatchPhase): boolean {
  return phase === 'running' || phase === 'done' || phase === 'aborted'
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportModal({ open, onClose, userId }: ImportModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [provider, setProvider] = useState<Provider>('MAX')
  const [fileFormat, setFileFormat] = useState<FileFormat>('xlsx')
  const [importMode, setImportMode] = useState<ImportMode>('single')
  const [loading, setLoading] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [noMatchError, setNoMatchError] = useState<string | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)

  const { batchState, startBatch, abort, reset, totals } = useBatchImport()

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose()
  }

  function handleClose() {
    setInlineError(null)
    setLoading(false)
    setImportResult(null)
    setImportMode('single')
    setNoMatchError(null)
    reset()
    if (fileRef.current) fileRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
    onClose()
  }

  function handleModeChange(mode: ImportMode) {
    setImportMode(mode)
    setInlineError(null)
    setNoMatchError(null)
    reset()
    if (fileRef.current) fileRef.current.value = ''
    if (folderRef.current) folderRef.current.value = ''
  }

  // ─── Single-file submit ────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (importMode === 'folder') {
      await handleFolderSubmit()
      return
    }

    setInlineError(null)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      const fileTypeName = fileFormat === 'xlsx' ? 'XLSX' : 'CSV'
      toast(`יש לבחור קובץ ${fileTypeName}`, 'error')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('provider', provider)
    formData.append('userId', userId)

    setLoading(true)
    try {
      const endpoint = fileFormat === 'xlsx' ? '/import/xlsx' : '/import/csv'
      const res = await apiClient.post<ImportResult>(endpoint, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const { inserted, duplicates, withinFileDuplicates, pendingSkipped } = res.data

      const parts: string[] = [`יובאו ${inserted} עסקאות`]
      if (duplicates > 0) parts.push(`${duplicates} כפולות דולגו`)
      if (withinFileDuplicates > 0) parts.push(`${withinFileDuplicates} חשודות ככפולות`)
      if (pendingSkipped > 0) parts.push(`${pendingSkipped} בקליטה דולגו`)
      toast(parts.join(' · '), 'success')

      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['accounts', user?.id ?? userId] })

      if (duplicates > 0 || withinFileDuplicates > 0 || pendingSkipped > 0) {
        setImportResult(res.data)
      } else {
        handleClose()
      }
    } catch (err) {
      if (axios.isAxiosError(err)) {
        const status = err.response?.status
        if (status === 409) {
          setInlineError('הקובץ הזה כבר יובא בעבר. בחר קובץ אחר או סגור.')
        } else if (status === 422) {
          const providerLabel = provider === 'MAX' ? 'MAX' : 'CAL'
          setInlineError(`הקובץ אינו מתאים ל-${providerLabel}. בדוק שבחרת את הספק הנכון.`)
        } else {
          toast('שגיאה בייבוא — נסה שוב', 'error')
        }
      } else {
        toast('שגיאה בייבוא — נסה שוב', 'error')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Folder submit ─────────────────────────────────────────────────────────

  async function handleFolderSubmit() {
    const fileList = folderRef.current?.files
    if (!fileList || fileList.length === 0) {
      toast('יש לבחור תיקייה', 'error')
      return
    }

    const files = filterFilesForFolder(fileList, provider)
    if (files.length === 0) {
      const ext = provider === 'MAX' ? 'XLSX' : 'CSV'
      setNoMatchError(`לא נמצאו קבצי ${ext} מתאימים בתיקייה הנבחרת`)
      return
    }

    setNoMatchError(null)
    await startBatch(files, provider, userId)
    await queryClient.invalidateQueries({ queryKey: ['transactions'] })
    await queryClient.invalidateQueries({ queryKey: ['accounts', user?.id ?? userId] })
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  const isFolder = importMode === 'folder'
  const batchActive = isActiveBatchPhase(batchState.phase)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={isFolder ? 'max-w-lg' : 'max-w-sm'}>
        <DialogHeader>
          <DialogTitle>ייבוא דוחות אשראי</DialogTitle>
          <DialogDescription>
            {isFolder
              ? 'בחר תיקייה לייבוא כל הקבצים המתאימים'
              : 'בחר ספק כרטיס אשראי, סוג קובץ וקובץ'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          {importResult ? (
            // ── Single-file results step ──────────────────────────────────────
            <>
              <div className="flex flex-col gap-3">
                <div className="rounded-md bg-primary/5 px-3 py-2.5">
                  <p className="text-sm">
                    יובאו {importResult.inserted} עסקאות
                    {importResult.duplicates > 0 && ` · ${importResult.duplicates} כפולות דולגו`}
                    {importResult.withinFileDuplicates > 0 &&
                      ` · ${importResult.withinFileDuplicates} חשודות ככפולות בתוך הקובץ`}
                    {importResult.pendingSkipped > 0 &&
                      ` · ${importResult.pendingSkipped} בקליטה דולגו`}
                  </p>
                </div>

                {importResult.skippedRows.length > 0 && (
                  <details className="rounded-md border border-border">
                    <summary className="cursor-pointer px-3 py-2 text-sm font-medium hover:bg-muted/50">
                      {importResult.duplicates} כפולות שדולגו — לחץ לפירוט
                    </summary>
                    <ul className="divide-y divide-border text-sm">
                      {importResult.skippedRows.map((row, i) => (
                        <li key={i} className="flex flex-col gap-0.5 px-3 py-2">
                          <span className="font-medium">{row.description}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatBankDate(new Date(row.date))} · {formatILS(row.amountAgorot)}
                          </span>
                          {row.originalImportedFrom && (
                            <span className="text-xs text-muted-foreground">
                              כבר קיים מ: {row.originalImportedFrom}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {importResult.withinFileDuplicates > 0 && (
                  <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
                    <p className="font-medium text-warning">
                      {importResult.withinFileDuplicates} עסקאות חשודות ככפולות בתוך הקובץ
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      עסקאות אלו יובאו ומסומנות בדף ההוצאות — בדוק אותן ואשר אם הן לגיטימיות.
                    </p>
                  </div>
                )}

                {importResult.pendingSkipped > 0 && (
                  <div className="rounded-md border border-border bg-muted/30 px-3 py-2.5 text-sm">
                    <p className="font-medium">{importResult.pendingSkipped} עסקאות בקליטה דולגו</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      עסקאות אלו טרם אושרו לחיוב. הן יופיעו בדוח הבא לאחר שיסולקו.
                    </p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" onClick={handleClose}>
                  סגור
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* ── Mode toggle ─────────────────────────────────────────────── */}
              <fieldset className="flex gap-2">
                <legend className="sr-only">מצב ייבוא</legend>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="importMode"
                    value="single"
                    checked={importMode === 'single'}
                    onChange={() => handleModeChange('single')}
                    className="accent-primary"
                  />
                  <span>קובץ בודד</span>
                </label>
                <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                  <input
                    type="radio"
                    name="importMode"
                    value="folder"
                    checked={importMode === 'folder'}
                    onChange={() => handleModeChange('folder')}
                    className="accent-primary"
                  />
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span>תיקייה</span>
                </label>
              </fieldset>

              {/* ── Provider picker ─────────────────────────────────────────── */}
              {!batchActive && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">ספק כרטיס האשראי</legend>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="provider"
                      value="MAX"
                      checked={provider === 'MAX'}
                      onChange={() => {
                        setProvider('MAX')
                        setInlineError(null)
                        setNoMatchError(null)
                      }}
                      className="accent-primary"
                    />
                    <span>MAX (מקס / לאומי קארד)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="provider"
                      value="CAL"
                      checked={provider === 'CAL'}
                      onChange={() => {
                        setProvider('CAL')
                        setInlineError(null)
                        setNoMatchError(null)
                      }}
                      className="accent-primary"
                    />
                    <span>CAL (כאל)</span>
                  </label>
                </fieldset>
              )}

              {/* ── File format picker (single mode only) ───────────────────── */}
              {importMode === 'single' && (
                <fieldset className="flex flex-col gap-2">
                  <legend className="text-sm font-medium">סוג קובץ</legend>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="fileFormat"
                      value="xlsx"
                      checked={fileFormat === 'xlsx'}
                      onChange={() => {
                        setFileFormat('xlsx')
                        setInlineError(null)
                      }}
                      className="accent-primary"
                    />
                    <span>XLSX (מומלץ)</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2.5 rounded-md border border-border px-3 py-2 text-sm transition-colors has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                    <input
                      type="radio"
                      name="fileFormat"
                      value="csv"
                      checked={fileFormat === 'csv'}
                      onChange={() => {
                        setFileFormat('csv')
                        setInlineError(null)
                      }}
                      className="accent-primary"
                    />
                    <span>CSV</span>
                  </label>
                </fieldset>
              )}

              {/* ── Single-file picker ──────────────────────────────────────── */}
              {importMode === 'single' && !batchActive && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" htmlFor="import-file">
                    {fileFormat === 'xlsx' ? 'קובץ XLSX' : 'קובץ CSV'}
                  </label>
                  <Input
                    id="import-file"
                    type="file"
                    accept={fileFormat === 'xlsx' ? '.xlsx,.xlsm' : '.csv'}
                    ref={fileRef}
                    onChange={() => setInlineError(null)}
                  />
                </div>
              )}

              {/* ── Folder picker (folder mode, not yet started) ─────────────── */}
              {importMode === 'folder' && !batchActive && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium" htmlFor="import-folder">
                    {provider === 'MAX' ? 'תיקיית MAX (קבצי XLSX)' : 'תיקיית CAL (קבצי CSV)'}
                  </label>
                  {/* webkitdirectory is non-standard; cast to avoid TS error */}
                  <input
                    id="import-folder"
                    ref={folderRef}
                    type="file"
                    {...({ webkitdirectory: '' } as React.InputHTMLAttributes<HTMLInputElement>)}
                    onChange={() => setNoMatchError(null)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-body-sm ring-offset-background file:border-0 file:bg-transparent file:text-body-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-xs text-muted-foreground">
                    {provider === 'MAX'
                      ? 'בחר את התיקייה המכילה את קבצי ה-XLSX של MAX'
                      : 'בחר את תיקיית השנה — הוא יסרוק את תתי-התיקיות לחיפוש קבצי CSV'}
                  </p>
                </div>
              )}

              {/* ── Batch progress list ─────────────────────────────────────── */}
              {importMode === 'folder' && batchActive && (
                <div className="flex flex-col gap-3">
                  <div className="max-h-64 overflow-y-auto rounded-md border border-border divide-y divide-border">
                    {batchState.entries.map(entry => (
                      <div
                        key={entry.relativePath}
                        className="flex items-start gap-3 px-3 py-2 text-sm"
                      >
                        <div className="mt-0.5 shrink-0">
                          {entry.status === 'pending' && (
                            <span className="mt-1 block h-2 w-2 rounded-full bg-border" />
                          )}
                          {entry.status === 'uploading' && (
                            <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          )}
                          {entry.status === 'imported' && (
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                          )}
                          {entry.status === 'already_imported' && (
                            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                          )}
                          {entry.status === 'error' && (
                            <AlertCircle className="h-4 w-4 text-destructive" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{entry.file.name}</p>
                          {entry.status === 'pending' && (
                            <p className="text-xs text-muted-foreground">ממתין...</p>
                          )}
                          {entry.status === 'uploading' && (
                            <p className="text-xs text-muted-foreground">מייבא...</p>
                          )}
                          {entry.status === 'imported' && entry.result && (
                            <p className="text-xs text-muted-foreground">
                              יובאו {entry.result.inserted} עסקאות
                              {entry.result.duplicates > 0 &&
                                ` · ${entry.result.duplicates} כפולות`}
                            </p>
                          )}
                          {entry.status === 'already_imported' && (
                            <p className="text-xs text-muted-foreground">כבר מיובא</p>
                          )}
                          {entry.status === 'error' && (
                            <p className="text-xs text-destructive">{entry.errorMessage}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Summary row */}
                  {(batchState.phase === 'done' || batchState.phase === 'aborted') && (
                    <div className="flex flex-col gap-2">
                      {batchState.phase === 'aborted' && (
                        <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5 text-sm">
                          <p className="font-medium text-warning">
                            הייבוא בוטל — {completedCount(batchState.entries)} מתוך{' '}
                            {batchState.entries.length} קבצים עובדו
                          </p>
                        </div>
                      )}
                      <div className="rounded-md bg-primary/5 px-3 py-2.5 text-sm">
                        <p>
                          סה״כ: יובאו {totals.inserted} עסקאות
                          {totals.alreadyImported > 0 &&
                            ` · ${totals.alreadyImported} קבצים כבר מיובאים`}
                          {totals.duplicates > 0 && ` · ${totals.duplicates} כפולות`}
                          {totals.errors > 0 && ` · ${totals.errors} שגיאות`}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Inline errors ───────────────────────────────────────────── */}
              {inlineError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{inlineError}</span>
                </div>
              )}

              {noMatchError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{noMatchError}</span>
                </div>
              )}

              {/* ── Action buttons ──────────────────────────────────────────── */}
              <div className="flex justify-end gap-2 pt-1">
                {/* Folder mode: running → show Abort */}
                {importMode === 'folder' && batchState.phase === 'running' && (
                  <Button type="button" variant="ghost" onClick={abort}>
                    בטל
                  </Button>
                )}

                {/* Folder mode: done/aborted → Close + Import another */}
                {importMode === 'folder' &&
                  (batchState.phase === 'done' || batchState.phase === 'aborted') && (
                    <>
                      <Button type="button" variant="ghost" onClick={handleClose}>
                        סגור
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          reset()
                          if (folderRef.current) folderRef.current.value = ''
                        }}
                      >
                        <FolderOpen className="me-1.5 h-4 w-4" />
                        ייבא תיקייה נוספת
                      </Button>
                    </>
                  )}

                {/* Single mode or folder idle → normal Cancel + Submit */}
                {(importMode === 'single' ||
                  (importMode === 'folder' && batchState.phase === 'idle')) && (
                  <>
                    <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                      ביטול
                    </Button>
                    <Button type="submit" disabled={loading}>
                      <Upload className="me-1.5 h-4 w-4" />
                      {loading ? 'מייבא...' : 'ייבא'}
                    </Button>
                  </>
                )}
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
