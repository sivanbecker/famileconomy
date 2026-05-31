'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { Transaction } from './use-transactions'
import type { ExpenseFilters } from './use-expenses'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MerchantBucket {
  id: string
  name: string
  descriptions: string[]
}

export interface MerchantBucketSummary {
  totalAgorot: number
  count: number
  avgMonthlyAgorot: number
  firstSeen: string | null
  lastSeen: string | null
}

export interface BucketChartDataPoint {
  year: number
  month: number
  label: string
  totalAgorot: number
  count: number
}

// ─── Chart data builder (pure, exported for tests) ───────────────────────────

export function buildBucketChartData(transactions: Transaction[]): BucketChartDataPoint[] {
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

// ─── Hooks ────────────────────────────────────────────────────────────────────

export function useMerchantBucket(bucketId: string, userId?: string) {
  return useQuery<MerchantBucket>({
    queryKey: ['merchant-bucket', bucketId, userId],
    queryFn: async () => {
      const res = await apiClient.get<{ bucket: MerchantBucket }>(`/merchant-buckets/${bucketId}`, {
        params: { userId },
      })
      return res.data.bucket
    },
    enabled: !!userId && !!bucketId,
  })
}

export function useMerchantBuckets(userId?: string) {
  return useQuery<MerchantBucket[]>({
    queryKey: ['merchant-buckets', userId],
    queryFn: async () => {
      const res = await apiClient.get<{ buckets: MerchantBucket[] }>('/merchant-buckets', {
        params: { userId },
      })
      return res.data.buckets
    },
    enabled: !!userId,
  })
}

export function useBucketTransactions(
  bucketId: string,
  year: number | null,
  filters: ExpenseFilters,
  userId?: string
) {
  return useQuery<{ transactions: Transaction[]; summary: MerchantBucketSummary }>({
    queryKey: ['bucket-transactions', bucketId, year, filters, userId],
    queryFn: async () => {
      const params: Record<string, unknown> = { userId }
      if (year !== null) params.year = year
      if (filters.search) params.search = filters.search
      if (filters.category) params.category = filters.category
      if (filters.minAmount !== undefined) params.minAmount = filters.minAmount
      if (filters.maxAmount !== undefined) params.maxAmount = filters.maxAmount
      if (filters.sortBy) params.sortBy = filters.sortBy
      if (filters.sortDir) params.sortDir = filters.sortDir
      if (filters.isMust !== undefined) params.isMust = filters.isMust
      const res = await apiClient.get<{
        transactions: Transaction[]
        summary: MerchantBucketSummary
      }>(`/merchant-buckets/${bucketId}/transactions`, { params })
      return res.data
    },
    enabled: !!userId && !!bucketId,
  })
}

export function useCreateMerchantBucket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { userId: string; name: string; descriptions: string[] }) => {
      const res = await apiClient.post<{ bucket: MerchantBucket }>('/merchant-buckets', data)
      return res.data.bucket
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['merchant-buckets', vars.userId] })
    },
  })
}

export function useRenameMerchantBucket(bucketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { userId: string; name: string }) => {
      const res = await apiClient.patch<{ bucket: MerchantBucket }>(
        `/merchant-buckets/${bucketId}`,
        data
      )
      return res.data.bucket
    },
    onSuccess: (bucket, vars) => {
      queryClient.setQueryData(['merchant-bucket', bucketId, vars.userId], bucket)
      void queryClient.invalidateQueries({ queryKey: ['merchant-buckets', vars.userId] })
    },
  })
}

export function useAddBucketDescription(bucketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { userId: string; description: string }) => {
      const res = await apiClient.post<{ descriptions: string[] }>(
        `/merchant-buckets/${bucketId}/descriptions`,
        data
      )
      return res.data.descriptions
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['merchant-bucket', bucketId, vars.userId] })
      void queryClient.invalidateQueries({ queryKey: ['bucket-transactions', bucketId] })
    },
  })
}

export function useRemoveBucketDescription(bucketId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { userId: string; description: string }) => {
      const res = await apiClient.delete<{ descriptions: string[] }>(
        `/merchant-buckets/${bucketId}/descriptions`,
        { data }
      )
      return res.data.descriptions
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['merchant-bucket', bucketId, vars.userId] })
      void queryClient.invalidateQueries({ queryKey: ['bucket-transactions', bucketId] })
    },
  })
}

export function useDeleteMerchantBucket() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (data: { bucketId: string; userId: string }) => {
      await apiClient.delete(`/merchant-buckets/${data.bucketId}`, {
        data: { userId: data.userId },
      })
    },
    onSuccess: (_, vars) => {
      void queryClient.invalidateQueries({ queryKey: ['merchant-buckets', vars.userId] })
    },
  })
}

export function useSearchDescriptions(userId: string | undefined, query: string) {
  return useQuery<string[]>({
    queryKey: ['description-search', userId, query],
    queryFn: async () => {
      const res = await apiClient.get<{ descriptions: string[] }>(
        '/merchant-buckets/search-descriptions',
        { params: { userId, q: query } }
      )
      return res.data.descriptions
    },
    enabled: !!userId && query.length >= 2,
  })
}
