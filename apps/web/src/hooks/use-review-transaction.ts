'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import type { ReviewStatus } from './use-transactions'

interface ReviewPayload {
  transactionId: string
  userId: string
  reviewStatus: ReviewStatus
}

interface BulkReviewPayload {
  userId: string
  ids: string[]
  reviewStatus: ReviewStatus
}

export function useReviewTransaction(_accountId: string | null, _year: number, _month: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ transactionId, userId, reviewStatus }: ReviewPayload) => {
      await apiClient.patch(`/transactions/${transactionId}/review`, { userId, reviewStatus })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useBulkReview(_accountId: string | null, _year: number, _month: number) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, ids, reviewStatus }: BulkReviewPayload) => {
      const res = await apiClient.patch<{ updated: number }>('/transactions/bulk-review', {
        userId,
        ids,
        reviewStatus,
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
