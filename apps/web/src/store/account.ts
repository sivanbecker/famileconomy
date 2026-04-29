import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AccountState {
  activeAccountId: string | null
  setActiveAccountId: (id: string) => void
}

export const useAccountStore = create<AccountState>()(
  persist(
    set => ({
      activeAccountId: null,
      setActiveAccountId: id => set({ activeAccountId: id }),
    }),
    { name: 'famileconomy-account' }
  )
)
