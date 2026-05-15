'use client'

import { useQueries } from '@tanstack/react-query'
import { apiClient } from '../lib/api'
import { ALL_ACCOUNTS } from '../store/account'
import type { Transaction } from './use-transactions'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthDataPoint {
  label: string
  year: number
  month: number
  totalAgorot: number
  mustAgorot: number
  niceToHaveAgorot: number
  niceToHavePct: number
}

// ─── Pure helpers (exported for unit tests) ───────────────────────────────────

const HEBREW_MONTHS_SHORT = [
  'ינו׳',
  'פבר׳',
  'מרצ׳',
  'אפר׳',
  'מאי',
  'יוני',
  'יולי',
  'אוג׳',
  'ספט׳',
  'אוק׳',
  'נוב׳',
  'דצמ׳',
] as const

export function buildMonthRange(
  anchorYear: number,
  anchorMonth: number,
  range: number
): { year: number; month: number }[] {
  const result: { year: number; month: number }[] = []
  for (let i = range - 1; i >= 0; i--) {
    let month = anchorMonth - i
    let year = anchorYear
    while (month <= 0) {
      month += 12
      year -= 1
    }
    result.push({ year, month })
  }
  return result
}

export function buildDataPoint(
  year: number,
  month: number,
  transactions: Transaction[]
): MonthDataPoint {
  let mustAgorot = 0
  let niceToHaveAgorot = 0

  for (const tx of transactions) {
    if (tx.amountAgorot <= 0) continue
    if (tx.isMust === false) {
      niceToHaveAgorot += tx.amountAgorot
    } else {
      mustAgorot += tx.amountAgorot
    }
  }

  const totalAgorot = mustAgorot + niceToHaveAgorot
  const niceToHavePct = totalAgorot > 0 ? (niceToHaveAgorot / totalAgorot) * 100 : 0
  const shortMonth = HEBREW_MONTHS_SHORT[(month - 1) % 12] ?? ''
  const shortYear = String(year).slice(2)
  const label = `${shortMonth} ${shortYear}`

  return { label, year, month, totalAgorot, mustAgorot, niceToHaveAgorot, niceToHavePct }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

interface TransactionsResponse {
  transactions: Transaction[]
}

export function useMultiMonthTransactions(
  accountId: string | null,
  userId: string | undefined,
  months: { year: number; month: number }[]
): { data: MonthDataPoint[]; isLoading: boolean } {
  const isAll = accountId === ALL_ACCOUNTS
  const enabled = isAll ? !!userId : !!accountId

  const results = useQueries({
    queries: months.map(({ year, month }) => ({
      queryKey: ['transactions', accountId, year, month, userId],
      queryFn: async (): Promise<Transaction[]> => {
        const params: Record<string, unknown> = isAll
          ? { userId, year, month }
          : { accountId, year, month }
        const res = await apiClient.get<TransactionsResponse>('/transactions', { params })
        return res.data.transactions
      },
      enabled,
    })),
  })

  const isLoading = results.some(r => r.isLoading)
  const data: MonthDataPoint[] = months.map(({ year, month }, i) => {
    // eslint-disable-next-line security/detect-object-injection
    const result = results[i]
    return buildDataPoint(year, month, result?.data ?? [])
  })

  return { data, isLoading }
}
