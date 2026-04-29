'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { summarizeMonth } from '@famileconomy/utils'
import type { MonthSummary } from '@famileconomy/utils'

export interface Transaction {
  id: string
  transactionDate: string
  description: string
  amountAgorot: number
  category: string | null
  cardLastFour: string | null
  status: string
  installmentNum: number | null
  installmentOf: number | null
}

interface TransactionsResponse {
  transactions: Transaction[]
}

export function useTransactions(accountId: string | null, year: number, month: number) {
  return useQuery<Transaction[]>({
    queryKey: ['transactions', accountId, year, month],
    queryFn: async () => {
      if (!accountId) return []
      const res = await apiClient.get<TransactionsResponse>('/transactions', {
        params: { accountId, year, month },
      })
      return res.data.transactions
    },
    enabled: !!accountId,
  })
}

export function useMonthSummary(
  accountId: string | null,
  year: number,
  month: number
): { data: MonthSummary; isLoading: boolean } {
  const { data: transactions = [], isLoading } = useTransactions(accountId, year, month)

  return {
    data: summarizeMonth(transactions),
    isLoading,
  }
}
