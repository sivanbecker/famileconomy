import { describe, expect, it } from 'vitest'
import { summarizeMonth } from '../month-summary'

// All amounts in agorot (integers). Positive = debit (expense), negative = credit card refund/reversal.
// Credit card statements have no salary income — negative rows are always reversals of prior debits.
// True income (salary, transfer-in) arrives via bank account imports with an explicit isIncome flag.

describe('summarizeMonth', () => {
  it('returns zeros for an empty transaction list', () => {
    expect(summarizeMonth([])).toEqual({ incomeAgorot: 0, expensesAgorot: 0, balanceAgorot: 0 })
  })

  it('counts positive amounts as expenses', () => {
    const result = summarizeMonth([{ amountAgorot: 5000 }, { amountAgorot: 3000 }])
    expect(result.expensesAgorot).toBe(8000)
    expect(result.incomeAgorot).toBe(0)
  })

  it('treats negative amounts as expense reductions (refunds/reversals), not income', () => {
    const result = summarizeMonth([
      { amountAgorot: 10000 }, // expense
      { amountAgorot: -3000 }, // refund / ביטול עסקה
    ])
    expect(result.expensesAgorot).toBe(7000)
    expect(result.incomeAgorot).toBe(0)
  })

  it('refund exactly cancels the matching expense', () => {
    const result = summarizeMonth([{ amountAgorot: 17600 }, { amountAgorot: -17600 }])
    expect(result.expensesAgorot).toBe(0)
    expect(result.incomeAgorot).toBe(0)
    expect(result.balanceAgorot).toBe(0)
  })

  it('expenses floor at zero when refunds exceed charges', () => {
    // Edge: more refunds than charges in the period (e.g. large refund, no offsetting purchase)
    const result = summarizeMonth([{ amountAgorot: 5000 }, { amountAgorot: -10000 }])
    expect(result.expensesAgorot).toBe(0)
    expect(result.incomeAgorot).toBe(0)
  })

  it('splits mixed transactions correctly — no income bucket from credit-card data', () => {
    const result = summarizeMonth([
      { amountAgorot: 5000 }, // grocery
      { amountAgorot: 3000 }, // transport
      { amountAgorot: -2000 }, // refund
    ])
    expect(result.expensesAgorot).toBe(6000)
    expect(result.incomeAgorot).toBe(0)
  })

  it('counts explicit income rows (isIncome: true)', () => {
    const result = summarizeMonth([
      { amountAgorot: 150000, isIncome: true }, // salary deposit
      { amountAgorot: 5000 }, // grocery expense
      { amountAgorot: 3000 }, // transport expense
    ])
    expect(result.incomeAgorot).toBe(150000)
    expect(result.expensesAgorot).toBe(8000)
    expect(result.balanceAgorot).toBe(142000)
  })

  it('balance = income - net expenses (after refunds)', () => {
    const result = summarizeMonth([
      { amountAgorot: 150000, isIncome: true },
      { amountAgorot: 5000 },
      { amountAgorot: 3000 },
      { amountAgorot: -1000 }, // refund
    ])
    expect(result.balanceAgorot).toBe(143000) // 150000 - (5000+3000-1000)
  })

  it('balance is negative when expenses exceed income', () => {
    const result = summarizeMonth([{ amountAgorot: 20000 }])
    expect(result.balanceAgorot).toBe(-20000)
  })

  it('ignores zero-amount transactions', () => {
    const result = summarizeMonth([{ amountAgorot: 0 }, { amountAgorot: 5000 }])
    expect(result.incomeAgorot).toBe(0)
    expect(result.expensesAgorot).toBe(5000)
  })

  it('handles a single large income row (MAX_SAFE_INTEGER range)', () => {
    const big = Number.MAX_SAFE_INTEGER - 1
    const result = summarizeMonth([{ amountAgorot: big, isIncome: true }])
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
