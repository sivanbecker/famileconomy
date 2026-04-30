import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const ALL_ACCOUNTS = 'ALL' as const

interface AccountState {
  // null = not yet loaded; 'ALL' = show all accounts; UUID = specific account
  activeAccountId: string | null
  setActiveAccountId: (id: string) => void
}

export const useAccountStore = create<AccountState>()(
  persist(
    set => ({
      activeAccountId: ALL_ACCOUNTS,
      setActiveAccountId: id => set({ activeAccountId: id }),
    }),
    { name: 'famileconomy-account' }
  )
)
