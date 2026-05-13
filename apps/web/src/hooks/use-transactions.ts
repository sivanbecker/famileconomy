'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { summarizeMonth } from '@famileconomy/utils'
import type { MonthSummary } from '@famileconomy/utils'
import { ALL_ACCOUNTS } from '../store/account'

export type TransactionStatus =
  | 'CLEARED'
  | 'PENDING'
  | 'DUPLICATE'
  | 'REVIEWED_OK'
  | 'WITHIN_FILE_DUPLICATE'

export interface Transaction {
  id: string
  transactionDate: string
  description: string
  amountAgorot: number
  category: string | null
  cardLastFour: string | null
  status: TransactionStatus
  installmentNum: number | null
  installmentOf: number | null
  notes: string | null
}

interface TransactionsResponse {
  transactions: Transaction[]
}

export function useTransactions(
  accountId: string | null,
  year: number,
  month: number,
  userId?: string
) {
  const isAll = accountId === ALL_ACCOUNTS
  const enabled = isAll ? !!userId : !!accountId

  return useQuery<Transaction[]>({
    queryKey: ['transactions', accountId, year, month, userId],
    queryFn: async () => {
      const params = isAll ? { userId, year, month } : { accountId, year, month }
      const res = await apiClient.get<TransactionsResponse>('/transactions', { params })
      return res.data.transactions
    },
    enabled,
  })
}

export function useMonthSummary(
  accountId: string | null,
  year: number,
  month: number,
  userId?: string
): { data: MonthSummary; isLoading: boolean } {
  const { data: transactions = [], isLoading } = useTransactions(accountId, year, month, userId)

  return {
    data: summarizeMonth(transactions),
    isLoading,
  }
}
