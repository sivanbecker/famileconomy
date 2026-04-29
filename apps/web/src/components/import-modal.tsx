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
import { useAccounts } from '../hooks/use-accounts'
import { toast } from './toast'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  const { data: accounts = [] } = useAccounts(userId)

  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [loading, setLoading] = useState(false)
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Auto-select first account when accounts load
  if (accounts.length > 0 && !selectedAccountId) {
    const first = accounts[0]
    if (first) setSelectedAccountId(first.id)
  }

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) handleClose()
  }

  function handleClose() {
    setDuplicateError(null)
    setLoading(false)
    if (fileRef.current) fileRef.current.value = ''
    onClose()
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setDuplicateError(null)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      toast('יש לבחור קובץ CSV', 'error')
      return
    }
    if (!selectedAccountId) {
      toast('יש לבחור חשבון', 'error')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('accountId', selectedAccountId)
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

      // Refresh transaction list for the active account
      await queryClient.invalidateQueries({ queryKey: ['transactions'] })

      handleClose()
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        setDuplicateError('הקובץ הזה כבר יובא בעבר. בחר קובץ אחר או סגור.')
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
          <DialogDescription>בחר חשבון וקובץ CSV מהבנק או חברת האשראי</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 pt-2">
          {/* Account selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="import-account">
              חשבון
            </label>
            <select
              id="import-account"
              className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              value={selectedAccountId}
              onChange={e => setSelectedAccountId(e.target.value)}
            >
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.name}
                </option>
              ))}
            </select>
          </div>

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
              onChange={() => setDuplicateError(null)}
            />
          </div>

          {/* Duplicate-file error — stays in modal so user can act */}
          {duplicateError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{duplicateError}</span>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" onClick={handleClose} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading || accounts.length === 0}>
              <Upload className="me-1.5 h-4 w-4" />
              {loading ? 'מייבא...' : 'ייבא'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
