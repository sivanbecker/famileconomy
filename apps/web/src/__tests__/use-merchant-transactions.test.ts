import { describe, it, expect } from 'vitest'
import { buildMerchantChartData } from '../hooks/use-merchant-transactions'
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

// ─── buildMerchantChartData ───────────────────────────────────────────────────

describe('buildMerchantChartData', () => {
  it('returns empty array for empty transaction list', () => {
    const result = buildMerchantChartData([])
    expect(result).toHaveLength(0)
  })

  it('groups transactions by year-month', () => {
    const txs = [
      makeTx({ transactionDate: '2026-01-10', amountAgorot: 5000 }),
      makeTx({ transactionDate: '2026-01-25', amountAgorot: 3000 }),
      makeTx({ transactionDate: '2026-02-05', amountAgorot: 8000 }),
    ]
    const result = buildMerchantChartData(txs)
    expect(result).toHaveLength(2)
  })

  it('sums amountAgorot within the same month', () => {
    const txs = [
      makeTx({ transactionDate: '2026-01-10', amountAgorot: 5000 }),
      makeTx({ transactionDate: '2026-01-25', amountAgorot: 3000 }),
    ]
    const result = buildMerchantChartData(txs)
    expect(result[0]?.totalAgorot).toBe(8000)
  })

  it('excludes credits (negative amountAgorot) from totals', () => {
    const txs = [
      makeTx({ transactionDate: '2026-01-10', amountAgorot: 5000 }),
      makeTx({ transactionDate: '2026-01-15', amountAgorot: -500 }),
    ]
    const result = buildMerchantChartData(txs)
    expect(result[0]?.totalAgorot).toBe(5000)
  })

  it('sorts results chronologically (oldest first)', () => {
    const txs = [
      makeTx({ transactionDate: '2026-03-01', amountAgorot: 1000 }),
      makeTx({ transactionDate: '2026-01-01', amountAgorot: 2000 }),
      makeTx({ transactionDate: '2026-02-01', amountAgorot: 3000 }),
    ]
    const result = buildMerchantChartData(txs)
    expect(result[0]?.month).toBe(1)
    expect(result[1]?.month).toBe(2)
    expect(result[2]?.month).toBe(3)
  })

  it('spans across year boundary correctly', () => {
    const txs = [
      makeTx({ transactionDate: '2025-12-10', amountAgorot: 4000 }),
      makeTx({ transactionDate: '2026-01-10', amountAgorot: 6000 }),
    ]
    const result = buildMerchantChartData(txs)
    expect(result).toHaveLength(2)
    expect(result[0]?.year).toBe(2025)
    expect(result[0]?.month).toBe(12)
    expect(result[1]?.year).toBe(2026)
    expect(result[1]?.month).toBe(1)
  })

  it('each data point includes year, month, totalAgorot, and count', () => {
    const txs = [
      makeTx({ transactionDate: '2026-05-10', amountAgorot: 7000 }),
      makeTx({ id: '2', transactionDate: '2026-05-20', amountAgorot: 3000 }),
    ]
    const result = buildMerchantChartData(txs)
    const point = result[0]
    expect(point).toMatchObject({
      year: 2026,
      month: 5,
      totalAgorot: 10000,
      count: 2,
    })
  })

  it('data point label is a non-empty string', () => {
    const txs = [makeTx({ transactionDate: '2026-01-10', amountAgorot: 5000 })]
    const result = buildMerchantChartData(txs)
    expect(typeof result[0]?.label).toBe('string')
    expect(result[0]?.label.length).toBeGreaterThan(0)
  })
})
