'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiClient } from '../lib/api'

export interface TransactionNote {
  id: string
  transactionId: string
  body: string
  createdAt: string
  updatedAt: string
}

interface NotesResponse {
  notes: TransactionNote[]
}

export function useTransactionNotes(transactionId: string, userId: string | undefined) {
  return useQuery<TransactionNote[]>({
    queryKey: ['transaction-notes', transactionId],
    queryFn: async () => {
      const res = await apiClient.get<NotesResponse>(`/transactions/${transactionId}/notes`, {
        params: { userId },
      })
      return res.data.notes
    },
    enabled: !!userId,
  })
}

export function useAddNote(transactionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, body }: { userId: string; body: string }) => {
      const res = await apiClient.post<{ note: TransactionNote }>(
        `/transactions/${transactionId}/notes`,
        { userId, body }
      )
      return res.data.note
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transaction-notes', transactionId] })
    },
  })
}

export function useUpdateNote(transactionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      noteId,
      userId,
      body,
    }: {
      noteId: string
      userId: string
      body: string
    }) => {
      const res = await apiClient.patch<{ note: TransactionNote }>(
        `/transactions/${transactionId}/notes/${noteId}`,
        { userId, body }
      )
      return res.data.note
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transaction-notes', transactionId] })
    },
  })
}

export function useDeleteNote(transactionId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ noteId, userId }: { noteId: string; userId: string }) => {
      await apiClient.delete(`/transactions/${transactionId}/notes/${noteId}`, {
        params: { userId },
      })
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['transaction-notes', transactionId] })
    },
  })
}
