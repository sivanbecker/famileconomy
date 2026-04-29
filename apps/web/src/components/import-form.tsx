'use client'

import { useEffect, useRef, useState } from 'react'
import axios from 'axios'
import { apiClient } from '../lib/api'
import { Button, Input } from '@famileconomy/ui'

interface Account {
  id: string
  name: string
  type: string
}

interface ImportResult {
  inserted: number
  duplicates: number
  errors: string[]
}

interface ImportFormProps {
  userId: string
}

export function ImportForm({ userId }: ImportFormProps) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    apiClient
      .get<{ accounts: Account[] }>('/accounts', { params: { userId } })
      .then(res => {
        setAccounts(res.data.accounts)
        const first = res.data.accounts[0]
        if (first) setSelectedAccountId(first.id)
      })
      .catch(() => setError('שגיאה בטעינת חשבונות'))
  }, [userId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setResult(null)

    const file = fileRef.current?.files?.[0]
    if (!file) {
      setError('יש לבחור קובץ')
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
      setResult(res.data)
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        const msg = err.response.data?.message as string | undefined
        if (err.response.status === 409) {
          setError(msg ?? 'הקובץ כבר יובא בעבר')
        } else {
          setError(msg ?? 'שגיאה בייבוא')
        }
      } else {
        setError('שגיאה בייבוא')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="account-select">חשבון</label>
        <select
          id="account-select"
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

      <div className="flex flex-col gap-1">
        <label htmlFor="csv-file">קובץ CSV</label>
        <Input id="csv-file" type="file" accept=".csv" ref={fileRef} />
      </div>

      {error && (
        <p role="alert" className="text-red-600 text-sm">
          {error}
        </p>
      )}

      {result && (
        <p className="text-green-600 text-sm">
          יובאו {result.inserted} עסקאות
          {result.duplicates > 0 && ` · ${result.duplicates} כפולות`}
        </p>
      )}

      <Button type="submit" disabled={loading}>
        {loading ? 'מייבא...' : 'ייבא'}
      </Button>
    </form>
  )
}
