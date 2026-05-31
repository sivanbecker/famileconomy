import { describe, it, expect } from 'vitest'
import { buildBucketChartData } from '../hooks/use-merchant-bucket'
import type { Transaction } from '../hooks/use-transactions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    transactionDate: '2026-01-15',
    description: 'ביטוח רכב',
    amountAgorot: 5000,
    category: 'ביטוח',
    cardLastFour: null,
    status: 'CLEARED',
    reviewStatus: null,
    installmentNum: null,
    installmentOf: null,
    notes: null,
    isMust: null,
    ...overrides,
  }
}

// ─── buildBucketChartData ─────────────────────────────────────────────────────

describe('buildBucketChartData', () => {
  it('returns empty array for empty transaction list', () => {
    expect(buildBucketChartData([])).toHaveLength(0)
  })

  it('groups transactions from multiple descriptions into the same monthly bucket', () => {
    const txs = [
      makeTx({ transactionDate: '2026-01-10', description: 'ביטוח א', amountAgorot: 5000 }),
      makeTx({ transactionDate: '2026-01-20', description: 'ביטוח ב', amountAgorot: 3000 }),
    ]
    const result = buildBucketChartData(txs)
    expect(result).toHaveLength(1)
    expect(result[0]?.totalAgorot).toBe(8000)
    expect(result[0]?.count).toBe(2)
  })

  it('separates transactions from different months even across descriptions', () => {
    const txs = [
      makeTx({ transactionDate: '2026-01-10', description: 'ביטוח א', amountAgorot: 5000 }),
      makeTx({ transactionDate: '2026-02-10', description: 'ביטוח ב', amountAgorot: 3000 }),
    ]
    const result = buildBucketChartData(txs)
    expect(result).toHaveLength(2)
  })

  it('excludes credits (amountAgorot <= 0)', () => {
    const txs = [
      makeTx({ transactionDate: '2026-01-10', amountAgorot: 8000 }),
      makeTx({ transactionDate: '2026-01-15', amountAgorot: -200 }),
      makeTx({ transactionDate: '2026-01-20', amountAgorot: 0 }),
    ]
    const result = buildBucketChartData(txs)
    expect(result[0]?.totalAgorot).toBe(8000)
    expect(result[0]?.count).toBe(1)
  })

  it('sorts chronologically oldest-first', () => {
    const txs = [
      makeTx({ transactionDate: '2026-03-01', amountAgorot: 1000 }),
      makeTx({ transactionDate: '2026-01-01', amountAgorot: 2000 }),
    ]
    const result = buildBucketChartData(txs)
    expect(result[0]?.month).toBe(1)
    expect(result[1]?.month).toBe(3)
  })

  it('handles year boundary correctly', () => {
    const txs = [
      makeTx({ transactionDate: '2025-12-15', amountAgorot: 4000 }),
      makeTx({ transactionDate: '2026-01-10', amountAgorot: 6000 }),
    ]
    const result = buildBucketChartData(txs)
    expect(result).toHaveLength(2)
    expect(result[0]?.year).toBe(2025)
    expect(result[1]?.year).toBe(2026)
  })

  it('each point has year, month, totalAgorot, count, label', () => {
    const txs = [makeTx({ transactionDate: '2026-05-10', amountAgorot: 7000 })]
    const result = buildBucketChartData(txs)
    const point = result[0]
    expect(point).toMatchObject({ year: 2026, month: 5, totalAgorot: 7000, count: 1 })
    expect(typeof point?.label).toBe('string')
    expect((point?.label.length ?? 0) > 0).toBe(true)
  })
})
