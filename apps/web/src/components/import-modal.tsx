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
import { Upload, AlertCircle } from 'lucide-react'
import { apiClient } from '../lib/api'
import { useAuth } from '../hooks/use-auth'
import { toast } from './toast'
import { formatBankDate, formatILS } from '@famileconomy/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'MAX' | 'CAL'
type FileFormat = 'xlsx' | 'csv'

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

// ─── Component ────────────────────────────────────────────────────────────────

export function ImportModal({ open, onClose, userId }: ImportModalProps) {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const [provider, setProvider] = useState<Provider>('MAX')
  const [fileFormat, setFileFormat] = useState<FileFormat>('xlsx')
  const [loading, setLoading] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose()
  }

  function handleClose() {
    setInlineError(null)
    setLoading(false)
    setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
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

      // Show results panel if there's anything to report
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

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ייבוא דוחות אשראי</DialogTitle>
          <DialogDescription>בחר ספק כרטיס אשראי, סוג קובץ וקובץ</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          {importResult ? (
            <>
              {/* Results step */}
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
              {/* Input controls */}
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
                    }}
                    className="accent-primary"
                  />
                  <span>CAL (כאל)</span>
                </label>
              </fieldset>

              {/* File format picker */}
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

              {/* File picker */}
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

              {/* Inline error — stays in modal so user can act */}
              {inlineError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{inlineError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-1">
                <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
                  ביטול
                </Button>
                <Button type="submit" disabled={loading}>
                  <Upload className="me-1.5 h-4 w-4" />
                  {loading ? 'מייבא...' : 'ייבא'}
                </Button>
              </div>
            </>
          )}
        </form>
      </DialogContent>
    </Dialog>
  )
}
