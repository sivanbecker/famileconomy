'use client'

import { useEffect } from 'react'
import { useAccounts, type Account } from '../hooks/use-accounts'
import { useAccountStore, ALL_ACCOUNTS } from '../store/account'

interface AccountSelectorProps {
  userId: string
}

export function AccountSelector({ userId }: AccountSelectorProps) {
  const { data: accounts = [], isLoading } = useAccounts(userId)
  const { activeAccountId, setActiveAccountId } = useAccountStore()

  // If a previously persisted account ID is no longer valid (deleted/changed), reset to ALL
  useEffect(() => {
    if (accounts.length === 0) return
    if (activeAccountId === ALL_ACCOUNTS || activeAccountId === null) return
    const stillValid = accounts.some(a => a.id === activeAccountId)
    if (!stillValid) setActiveAccountId(ALL_ACCOUNTS)
  }, [accounts, activeAccountId, setActiveAccountId])

  if (isLoading) {
    return (
      <div
        className="h-9 w-40 animate-pulse motion-reduce:animate-none rounded-md bg-surface-2"
        aria-label="טוען חשבונות"
      />
    )
  }

  if (accounts.length === 0) return null

  return (
    <select
      className="h-9 rounded-md border border-border bg-surface px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
      value={activeAccountId ?? ALL_ACCOUNTS}
      onChange={e => setActiveAccountId(e.target.value)}
      aria-label="בחר חשבון"
    >
      <option value={ALL_ACCOUNTS}>כל החשבונות</option>
      {accounts.map((account: Account) => (
        <option key={account.id} value={account.id}>
          {account.name}
        </option>
      ))}
    </select>
  )
}
