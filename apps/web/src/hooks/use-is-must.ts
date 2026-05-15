'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

interface SetIsMustPayload {
  transactionId: string
  userId: string
  isMust: boolean | null
}

interface BulkSetIsMustPayload {
  userId: string
  ids: string[]
  isMust: boolean | null
}

export function useSetIsMust() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ transactionId, userId, isMust }: SetIsMustPayload) => {
      await apiClient.patch(`/transactions/${transactionId}/is-must`, { userId, isMust })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}

export function useBulkSetIsMust() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, ids, isMust }: BulkSetIsMustPayload) => {
      const res = await apiClient.patch<{ updated: number }>('/transactions/bulk-is-must', {
        userId,
        ids,
        isMust,
      })
      return res.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['expenses'] })
      void queryClient.invalidateQueries({ queryKey: ['transactions'] })
    },
  })
}
