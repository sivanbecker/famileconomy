'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { ALL_ACCOUNTS } from '../store/account'
import type { Transaction } from './use-transactions'

export type SortField = 'date' | 'amount' | 'category' | 'description'
export type SortDir = 'asc' | 'desc'

export interface ExpenseFilters {
  search?: string
  category?: string
  minAmount?: number
  maxAmount?: number
  sortBy?: SortField
  sortDir?: SortDir
}

interface TransactionsResponse {
  transactions: Transaction[]
}

export function useExpenses(
  accountId: string | null,
  year: number,
  month: number,
  filters: ExpenseFilters,
  userId?: string
) {
  const isAll = accountId === ALL_ACCOUNTS
  const enabled = isAll ? !!userId : !!accountId

  return useQuery<Transaction[]>({
    queryKey: ['expenses', accountId, year, month, filters, userId],
    queryFn: async () => {
      const params: Record<string, unknown> = isAll
        ? { userId, year, month }
        : { accountId, year, month }
      if (filters.search) params.search = filters.search
      if (filters.category) params.category = filters.category
      if (filters.minAmount !== undefined) params.minAmount = filters.minAmount
      if (filters.maxAmount !== undefined) params.maxAmount = filters.maxAmount
      if (filters.sortBy) params.sortBy = filters.sortBy
      if (filters.sortDir) params.sortDir = filters.sortDir
      const res = await apiClient.get<TransactionsResponse>('/transactions', { params })
      return res.data.transactions
    },
    enabled,
  })
}

export function useUpdateCategory(_accountId: string | null, _year: number, _month: number) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      transactionId,
      category,
      userId,
    }: {
      transactionId: string
      category: string | null
      userId: string
    }) => {
      const res = await apiClient.patch<{ category: string | null }>(
        `/transactions/${transactionId}/category`,
        { category, userId }
      )
      return res.data
    },
    onSuccess: () => {
      // Invalidate all transaction queries for this month so dashboard + expenses page refresh
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
    },
  })
}
