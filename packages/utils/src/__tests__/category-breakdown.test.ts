import { describe, expect, it } from 'vitest'
import { categoryBreakdown } from '../category-breakdown'

describe('categoryBreakdown', () => {
  it('returns empty array for no transactions', () => {
    expect(categoryBreakdown([])).toEqual([])
  })

  it('groups expenses by category and sums agorot', () => {
    const result = categoryBreakdown([
      { amountAgorot: 5000, category: 'מזון' },
      { amountAgorot: 3000, category: 'מזון' },
      { amountAgorot: 8000, category: 'תחבורה' },
    ])
    expect(result).toHaveLength(2)
    const food = result.find(r => r.category === 'מזון')
    const transport = result.find(r => r.category === 'תחבורה')
    expect(food?.amountAgorot).toBe(8000)
    expect(transport?.amountAgorot).toBe(8000)
  })

  it('sorts by amountAgorot descending', () => {
    const result = categoryBreakdown([
      { amountAgorot: 1000, category: 'קטן' },
      { amountAgorot: 9000, category: 'גדול' },
      { amountAgorot: 4000, category: 'בינוני' },
    ])
    expect(result.map(r => r.category)).toEqual(['גדול', 'בינוני', 'קטן'])
  })

  it('uses "אחר" for null or missing category', () => {
    const result = categoryBreakdown([
      { amountAgorot: 5000, category: null },
      { amountAgorot: 3000, category: null },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.category).toBe('אחר')
    expect(result[0]?.amountAgorot).toBe(8000)
  })

  it('mixes null and named categories correctly', () => {
    const result = categoryBreakdown([
      { amountAgorot: 5000, category: 'מזון' },
      { amountAgorot: 3000, category: null },
      { amountAgorot: 2000, category: null },
    ])
    expect(result).toHaveLength(2)
    const other = result.find(r => r.category === 'אחר')
    expect(other?.amountAgorot).toBe(5000)
  })

  it('excludes refunds/reversals (negative amounts) from breakdown', () => {
    const result = categoryBreakdown([
      { amountAgorot: 5000, category: 'מזון' },
      { amountAgorot: -2000, category: 'מזון' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.amountAgorot).toBe(5000)
  })

  it('excludes zero-amount rows', () => {
    const result = categoryBreakdown([
      { amountAgorot: 0, category: 'מזון' },
      { amountAgorot: 5000, category: 'תחבורה' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.category).toBe('תחבורה')
  })

  it('computes percentage of total for each slice', () => {
    const result = categoryBreakdown([
      { amountAgorot: 3000, category: 'מזון' },
      { amountAgorot: 7000, category: 'תחבורה' },
    ])
    const transport = result.find(r => r.category === 'תחבורה')
    const food = result.find(r => r.category === 'מזון')
    expect(transport?.percent).toBeCloseTo(70, 1)
    expect(food?.percent).toBeCloseTo(30, 1)
  })

  it('handles a single category — 100%', () => {
    const result = categoryBreakdown([{ amountAgorot: 5000, category: 'מזון' }])
    expect(result[0]?.percent).toBe(100)
  })

  it('handles MAX_SAFE_INTEGER range without overflow', () => {
    const big = 9_000_000_000_000
    const result = categoryBreakdown([{ amountAgorot: big, category: 'גדול' }])
    expect(result[0]?.amountAgorot).toBe(big)
    expect(result[0]?.percent).toBe(100)
  })

  it('skips income rows (isIncome: true)', () => {
    const result = categoryBreakdown([
      { amountAgorot: 150000, category: 'משכורת', isIncome: true },
      { amountAgorot: 5000, category: 'מזון' },
    ])
    expect(result).toHaveLength(1)
    expect(result[0]?.category).toBe('מזון')
  })
})
