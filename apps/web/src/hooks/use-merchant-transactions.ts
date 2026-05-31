'use client'

import { useQuery } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Transaction } from './use-transactions'
import type { ExpenseFilters } from './use-expenses'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MerchantSummary {
  totalAgorot: number
  count: number
  avgMonthlyAgorot: number
  firstSeen: string | null
  lastSeen: string | null
}

export interface MerchantChartDataPoint {
  year: number
  month: number
  label: string
  totalAgorot: number
  count: number
}

interface MerchantTransactionsResponse {
  transactions: Transaction[]
  summary: MerchantSummary
}

// ─── Chart data builder (pure, exported for tests) ───────────────────────────

export function buildMerchantChartData(transactions: Transaction[]): MerchantChartDataPoint[] {
  const map = new Map<string, { year: number; month: number; totalAgorot: number; count: number }>()

  for (const tx of transactions) {
    if (tx.amountAgorot <= 0) continue
    const key = tx.transactionDate.slice(0, 7) // "YYYY-MM"
    const year = parseInt(tx.transactionDate.slice(0, 4), 10)
    const month = parseInt(tx.transactionDate.slice(5, 7), 10)
    const prev = map.get(key) ?? { year, month, totalAgorot: 0, count: 0 }
    map.set(key, {
      ...prev,
      totalAgorot: prev.totalAgorot + tx.amountAgorot,
      count: prev.count + 1,
    })
  }

  return Array.from(map.values())
    .sort((a, b) => (a.year !== b.year ? a.year - b.year : a.month - b.month))
    .map(p => ({
      ...p,
      label: new Date(p.year, p.month - 1, 1).toLocaleDateString('he-IL', {
        month: 'short',
        year: '2-digit',
      }),
    }))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useMerchantTransactions(
  merchant: string,
  year: number | null,
  filters: ExpenseFilters,
  userId?: string
) {
  return useQuery<{ transactions: Transaction[]; summary: MerchantSummary }>({
    queryKey: ['merchant-transactions', merchant, year, filters, userId],
    queryFn: async () => {
      const params: Record<string, unknown> = { userId, merchant }
      if (year !== null) params.year = year
      if (filters.search) params.search = filters.search
      if (filters.category) params.category = filters.category
      if (filters.minAmount !== undefined) params.minAmount = filters.minAmount
      if (filters.maxAmount !== undefined) params.maxAmount = filters.maxAmount
      if (filters.sortBy) params.sortBy = filters.sortBy
      if (filters.sortDir) params.sortDir = filters.sortDir
      if (filters.isMust !== undefined) params.isMust = filters.isMust
      const res = await apiClient.get<MerchantTransactionsResponse>('/transactions/by-merchant', {
        params,
      })
      return res.data
    },
    enabled: !!userId && !!merchant,
  })
}
