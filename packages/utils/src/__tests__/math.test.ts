import { describe, expect, it } from 'vitest'
import { addShekels, budgetPct, budgetRemaining } from '../math'

describe('addShekels', () => {
  it('adds two positive integer amounts', () => {
    expect(addShekels(1050, 500)).toBe(1550)
  })

  it('adds zero to an amount', () => {
    expect(addShekels(1050, 0)).toBe(1050)
  })

  it('adds two zeros', () => {
    expect(addShekels(0, 0)).toBe(0)
  })

  it('adds a negative amount (credit/refund)', () => {
    expect(addShekels(1050, -500)).toBe(550)
  })

  it('adds two negative amounts', () => {
    expect(addShekels(-1050, -500)).toBe(-1550)
  })

  it('throws when given a float', () => {
    expect(() => addShekels(10.5, 500)).toThrow()
    expect(() => addShekels(500, 10.5)).toThrow()
  })

  it('throws when given NaN', () => {
    expect(() => addShekels(NaN, 500)).toThrow()
  })

  it('handles Number.MAX_SAFE_INTEGER without silent overflow', () => {
    // Result is a number, not silently wrong — JS arithmetic on safe integers stays exact
    const result = addShekels(Number.MAX_SAFE_INTEGER - 1, 1)
    expect(result).toBe(Number.MAX_SAFE_INTEGER)
  })
})

describe('budgetRemaining', () => {
  it('returns the difference when budget exceeds spent', () => {
    expect(budgetRemaining(10_000, 6_000)).toBe(4_000)
  })

  it('returns zero when spent equals budget', () => {
    expect(budgetRemaining(10_000, 10_000)).toBe(0)
  })

  it('returns zero when spent exceeds budget (never negative)', () => {
    expect(budgetRemaining(10_000, 12_000)).toBe(0)
  })

  it('floors the result — never rounds up money you do not have', () => {
    // 10001 - 9999.7 = 1.3 → Math.floor → 1
    expect(budgetRemaining(10001, 9999.7)).toBe(1)
  })

  it('returns zero for a zero budget', () => {
    expect(budgetRemaining(0, 0)).toBe(0)
  })

  it('returns zero when budget is zero and spent is positive', () => {
    expect(budgetRemaining(0, 500)).toBe(0)
  })

  it('handles large amounts without losing precision', () => {
    expect(budgetRemaining(1_000_000_00, 999_999_99)).toBe(1)
  })
})

describe('budgetPct', () => {
  it('returns 0 when budget is zero (avoids division by zero)', () => {
    expect(budgetPct(0, 0)).toBe(0)
    expect(budgetPct(0, 500)).toBe(0)
  })

  it('returns 0 when nothing has been spent', () => {
    expect(budgetPct(10_000, 0)).toBe(0)
  })

  it('returns 50 when half the budget is spent', () => {
    expect(budgetPct(10_000, 5_000)).toBe(50)
  })

  it('returns 100 when budget is fully spent', () => {
    expect(budgetPct(10_000, 10_000)).toBe(100)
  })

  it('caps at 100 when spent exceeds budget', () => {
    expect(budgetPct(10_000, 15_000)).toBe(100)
  })

  it('rounds to the nearest integer', () => {
    // 1/3 of 10000 = 3333.33... → 33%
    expect(budgetPct(10_000, 3_333)).toBe(33)
  })

  it('handles one agorot spent against a large budget', () => {
    expect(budgetPct(1_000_000_00, 1)).toBe(0)
  })

  it('handles negative spent (should not occur in practice — clamped by max)', () => {
    // negative spent makes % negative, capped at max(100, ...) still returns a value
    // main guarantee: result does not exceed 100
    expect(budgetPct(10_000, -100)).toBeLessThanOrEqual(100)
  })
})
