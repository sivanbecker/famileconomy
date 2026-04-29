'use client'

import { useEffect } from 'react'
import { useAccounts, type Account } from '../hooks/use-accounts'
import { useAccountStore } from '../store/account'

interface AccountSelectorProps {
  userId: string
}

export function AccountSelector({ userId }: AccountSelectorProps) {
  const { data: accounts = [], isLoading } = useAccounts(userId)
  const { activeAccountId, setActiveAccountId } = useAccountStore()

  // Auto-select first account when none is selected or the stored id is no longer valid
  useEffect(() => {
    if (accounts.length === 0) return
    const validId = accounts.find(a => a.id === activeAccountId)?.id
    if (!validId) {
      const first = accounts[0]
      if (first) setActiveAccountId(first.id)
    }
  }, [accounts, activeAccountId, setActiveAccountId])

  if (isLoading) {
    return (
      <div className="h-9 w-40 animate-pulse rounded-md bg-surface-2" aria-label="טוען חשבונות" />
    )
  }

  if (accounts.length === 0) return null

  return (
    <select
      className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      value={activeAccountId ?? ''}
      onChange={e => setActiveAccountId(e.target.value)}
      aria-label="בחר חשבון"
    >
      {accounts.map((account: Account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  )
}
