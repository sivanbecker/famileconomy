import { describe, it, expect } from 'vitest'
import { buildMonthRange, buildDataPoint } from '../hooks/use-multi-month'
import type { Transaction } from '../hooks/use-transactions'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeTx(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: '1',
    transactionDate: '2026-01-15',
    description: 'test',
    amountAgorot: 5000,
    category: null,
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

// ─── buildMonthRange ──────────────────────────────────────────────────────────

describe('buildMonthRange', () => {
  it('returns exactly range entries', () => {
    const result = buildMonthRange(2026, 5, 3)
    expect(result).toHaveLength(3)
  })

  it('last entry is the anchor month', () => {
    const result = buildMonthRange(2026, 5, 3)
    const last = result[result.length - 1]
    expect(last).toEqual({ year: 2026, month: 5 })
  })

  it('entries are in ascending order (oldest first)', () => {
    const result = buildMonthRange(2026, 3, 3)
    expect(result[0]).toEqual({ year: 2026, month: 1 })
    expect(result[1]).toEqual({ year: 2026, month: 2 })
    expect(result[2]).toEqual({ year: 2026, month: 3 })
  })

  it('wraps correctly across year boundary', () => {
    const result = buildMonthRange(2026, 2, 4)
    expect(result[0]).toEqual({ year: 2025, month: 11 })
    expect(result[1]).toEqual({ year: 2025, month: 12 })
    expect(result[2]).toEqual({ year: 2026, month: 1 })
    expect(result[3]).toEqual({ year: 2026, month: 2 })
  })

  it('supports range=12', () => {
    const result = buildMonthRange(2026, 12, 12)
    expect(result).toHaveLength(12)
    expect(result[0]).toEqual({ year: 2026, month: 1 })
    expect(result[11]).toEqual({ year: 2026, month: 12 })
  })

  it('supports range=24 spanning two years', () => {
    const result = buildMonthRange(2026, 12, 24)
    expect(result).toHaveLength(24)
    expect(result[0]).toEqual({ year: 2025, month: 1 })
    expect(result[23]).toEqual({ year: 2026, month: 12 })
  })
})

// ─── buildDataPoint ───────────────────────────────────────────────────────────

describe('buildDataPoint', () => {
  it('returns zero totals for empty transaction list', () => {
    const dp = buildDataPoint(2026, 3, [])
    expect(dp.totalAgorot).toBe(0)
    expect(dp.mustAgorot).toBe(0)
    expect(dp.niceToHaveAgorot).toBe(0)
    expect(dp.niceToHavePct).toBe(0)
  })

  it('counts expense (positive amountAgorot) with isMust=null as must', () => {
    const dp = buildDataPoint(2026, 3, [makeTx({ amountAgorot: 5000, isMust: null })])
    expect(dp.mustAgorot).toBe(5000)
    expect(dp.niceToHaveAgorot).toBe(0)
  })

  it('counts expense with isMust=true as must', () => {
    const dp = buildDataPoint(2026, 3, [makeTx({ amountAgorot: 3000, isMust: true })])
    expect(dp.mustAgorot).toBe(3000)
    expect(dp.niceToHaveAgorot).toBe(0)
  })

  it('counts expense with isMust=false as nice-to-have', () => {
    const dp = buildDataPoint(2026, 3, [makeTx({ amountAgorot: 2000, isMust: false })])
    expect(dp.mustAgorot).toBe(0)
    expect(dp.niceToHaveAgorot).toBe(2000)
  })

  it('ignores credits (negative amountAgorot)', () => {
    const dp = buildDataPoint(2026, 3, [makeTx({ amountAgorot: -1000, isMust: null })])
    expect(dp.totalAgorot).toBe(0)
    expect(dp.mustAgorot).toBe(0)
  })

  it('sums multiple transactions correctly', () => {
    const dp = buildDataPoint(2026, 3, [
      makeTx({ amountAgorot: 5000, isMust: null }),
      makeTx({ amountAgorot: 3000, isMust: false }),
      makeTx({ amountAgorot: -500, isMust: null }), // credit — ignored
    ])
    expect(dp.mustAgorot).toBe(5000)
    expect(dp.niceToHaveAgorot).toBe(3000)
    expect(dp.totalAgorot).toBe(8000)
  })

  it('calculates niceToHavePct as percentage of total expenses', () => {
    const dp = buildDataPoint(2026, 3, [
      makeTx({ amountAgorot: 3000, isMust: null }),
      makeTx({ amountAgorot: 1000, isMust: false }),
    ])
    // 1000 / 4000 * 100 = 25
    expect(dp.niceToHavePct).toBeCloseTo(25)
  })

  it('niceToHavePct is 0 when there are no expenses', () => {
    const dp = buildDataPoint(2026, 3, [makeTx({ amountAgorot: -500 })])
    expect(dp.niceToHavePct).toBe(0)
  })

  it('produces a label in the format "מג׳ 26" style short month', () => {
    const dp = buildDataPoint(2026, 1, [])
    expect(dp.label).toBeTruthy()
    expect(typeof dp.label).toBe('string')
    expect(dp.year).toBe(2026)
    expect(dp.month).toBe(1)
  })
})
