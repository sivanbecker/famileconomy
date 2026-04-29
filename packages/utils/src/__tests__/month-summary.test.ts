import { describe, expect, it } from 'vitest'
import { summarizeMonth } from '../month-summary'

// All amounts in agorot (integers). Positive = debit (expense), negative = credit (income).

describe('summarizeMonth', () => {
  it('returns zeros for an empty transaction list', () => {
    expect(summarizeMonth([])).toEqual({ incomeAgorot: 0, expensesAgorot: 0, balanceAgorot: 0 })
  })

  it('counts positive amounts as expenses', () => {
    const result = summarizeMonth([{ amountAgorot: 5000 }, { amountAgorot: 3000 }])
    expect(result.expensesAgorot).toBe(8000)
    expect(result.incomeAgorot).toBe(0)
  })

  it('counts negative amounts as income', () => {
    const result = summarizeMonth([{ amountAgorot: -150000 }, { amountAgorot: -50000 }])
    expect(result.incomeAgorot).toBe(200000)
    expect(result.expensesAgorot).toBe(0)
  })

  it('splits mixed transactions correctly', () => {
    const result = summarizeMonth([
      { amountAgorot: -150000 }, // salary income
      { amountAgorot: 5000 }, // grocery expense
      { amountAgorot: 3000 }, // transport expense
      { amountAgorot: -2000 }, // cashback credit
    ])
    expect(result.incomeAgorot).toBe(152000)
    expect(result.expensesAgorot).toBe(8000)
  })

  it('balance = income - expenses', () => {
    const result = summarizeMonth([
      { amountAgorot: -150000 },
      { amountAgorot: 5000 },
      { amountAgorot: 3000 },
    ])
    expect(result.balanceAgorot).toBe(142000)
  })

  it('balance is negative when expenses exceed income', () => {
    const result = summarizeMonth([{ amountAgorot: -10000 }, { amountAgorot: 20000 }])
    expect(result.balanceAgorot).toBe(-10000)
  })

  it('ignores zero-amount transactions', () => {
    const result = summarizeMonth([{ amountAgorot: 0 }, { amountAgorot: 5000 }])
    expect(result.incomeAgorot).toBe(0)
    expect(result.expensesAgorot).toBe(5000)
  })

  it('handles a single large income (MAX_SAFE_INTEGER range)', () => {
    const big = Number.MAX_SAFE_INTEGER - 1
    const result = summarizeMonth([{ amountAgorot: -big }])
    expect(result.incomeAgorot).toBe(big)
    expect(result.balanceAgorot).toBe(big)
  })

  it('throws if a non-integer amount is passed', () => {
    expect(() => summarizeMonth([{ amountAgorot: 10.5 }])).toThrow()
  })

  it('throws if a NaN amount is passed', () => {
    expect(() => summarizeMonth([{ amountAgorot: NaN }])).toThrow()
  })
})
