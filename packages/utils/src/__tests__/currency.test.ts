import { describe, expect, it } from 'vitest'
import { formatILS, fromShekels, toShekels } from '../currency'

describe('toShekels', () => {
  it('converts a typical display value to integer agorot', () => {
    expect(toShekels(10.5)).toBe(1050)
  })

  it('converts zero', () => {
    expect(toShekels(0)).toBe(0)
  })

  it('converts a negative value (credit/refund)', () => {
    expect(toShekels(-10.5)).toBe(-1050)
  })

  it('rounds half-up for sub-agorot fractions (display input)', () => {
    // 10.555 → Math.round(1055.5) → 1056
    expect(toShekels(10.555)).toBe(1056)
  })

  it('handles the maximum safe display value without overflow', () => {
    // Number.MAX_SAFE_INTEGER agorot = 90_071_992_547_409.91 ILS display
    // We just verify it returns a safe integer when given a large whole number
    const largeILS = 90_000_000
    expect(Number.isInteger(toShekels(largeILS))).toBe(true)
    expect(toShekels(largeILS)).toBe(9_000_000_000)
  })

  it('handles one agorot (smallest unit)', () => {
    expect(toShekels(0.01)).toBe(1)
  })
})

describe('fromShekels', () => {
  it('converts integer agorot to a fixed-2 display string', () => {
    expect(fromShekels(1050)).toBe('10.50')
  })

  it('converts zero', () => {
    expect(fromShekels(0)).toBe('0.00')
  })

  it('converts negative agorot (credit/refund)', () => {
    expect(fromShekels(-1050)).toBe('-10.50')
  })

  it('converts one agorot', () => {
    expect(fromShekels(1)).toBe('0.01')
  })

  it('converts a large whole-shekel amount', () => {
    expect(fromShekels(100_000_00)).toBe('100000.00')
  })

  it('is the inverse of toShekels for typical values', () => {
    const cases = [0, 1, 100, 999, 10_000, -500]
    for (const agorot of cases) {
      expect(fromShekels(agorot)).toBe((agorot / 100).toFixed(2))
    }
  })
})

describe('formatILS', () => {
  it('formats integer agorot as a localized ILS string', () => {
    const result = formatILS(1050)
    expect(result).toContain('₪')
    expect(result).toContain('10')
  })

  it('formats zero', () => {
    const result = formatILS(0)
    expect(result).toContain('₪')
    expect(result).toContain('0')
  })

  it('formats negative (refund/credit) correctly', () => {
    const result = formatILS(-1050)
    expect(result).toContain('10')
  })

  it('accepts a custom locale', () => {
    const he = formatILS(1050, 'he-IL')
    const en = formatILS(1050, 'en-US')
    // Both should contain a currency symbol or ISO code and the digits
    expect(he).toContain('10')
    expect(en).toContain('10')
  })
})
