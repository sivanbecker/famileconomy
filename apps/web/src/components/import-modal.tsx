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

// ─── Types ────────────────────────────────────────────────────────────────────

type Provider = 'MAX' | 'CAL'

interface ImportResult {
  inserted: number
  duplicates: number
  errors: string[]
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
  const [loading, setLoading] = useState(false)
  const [inlineError, setInlineError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose()
  }

  function handleClose() {
    setInlineError(null)
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setInlineError(null)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast('יש לבחור קובץ CSV', 'error')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('provider', provider)
    formData.append('userId', userId)

    setLoading(true)
    try {
      const res = await apiClient.post<ImportResult>('/import/csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      const { inserted, duplicates } = res.data

      const parts: string[] = [`יובאו ${inserted} עסקאות`]
      if (duplicates > 0) parts.push(`${duplicates} כפולות דולגו`)
      toast(parts.join(' · '), 'success')

      await queryClient.invalidateQueries({ queryKey: ['transactions'] })
      await queryClient.invalidateQueries({ queryKey: ['accounts', user?.id ?? userId] })

      handleClose()
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
          <DialogDescription>בחר ספק כרטיס אשראי וקובץ CSV</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          {/* Provider picker */}
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

          {/* File picker */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="import-file">
              קובץ CSV
            </label>
            <Input
              id="import-file"
              type="file"
              accept=".csv"
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
        </form>
      </DialogContent>
    </Dialog>
  )
}
