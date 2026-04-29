'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface Account {
  id: string
  name: string
  type: string
  currency: string
}

interface AccountsResponse {
  accounts: Account[]
}

export function useAccounts(userId: string | null) {
  return useQuery<Account[]>({
    queryKey: ['accounts', userId],
    queryFn: async () => {
      if (!userId) return []
      const res = await apiClient.get<AccountsResponse>('/accounts', {
        params: { userId },
      })
      return res.data.accounts
    },
    enabled: !!userId,
  })
}
