import { describe, expect, it } from 'vitest'
import { formatBankDate, getMonthYear, parseBankDate } from '../dates'

describe('parseBankDate', () => {
  it('parses a valid DD/MM/YYYY string', () => {
    const d = parseBankDate('15/06/2024')
    expect(d.getUTCFullYear()).toBe(2024)
    expect(d.getUTCMonth()).toBe(5) // 0-indexed
    expect(d.getUTCDate()).toBe(15)
  })

  it('parses the first of January', () => {
    const d = parseBankDate('01/01/2024')
    expect(d.getUTCMonth()).toBe(0)
    expect(d.getUTCDate()).toBe(1)
  })

  it('parses the last of December', () => {
    const d = parseBankDate('31/12/2024')
    expect(d.getUTCMonth()).toBe(11)
    expect(d.getUTCDate()).toBe(31)
  })

  it('throws on a string with wrong separator', () => {
    expect(() => parseBankDate('15-06-2024')).toThrow()
  })

  it('throws on an empty string', () => {
    expect(() => parseBankDate('')).toThrow()
  })
})

describe('formatBankDate', () => {
  it('formats a date as DD/MM/YYYY', () => {
    const d = new Date(Date.UTC(2024, 5, 15))
    expect(formatBankDate(d)).toBe('15/06/2024')
  })

  it('zero-pads single-digit day and month', () => {
    const d = new Date(Date.UTC(2024, 0, 5))
    expect(formatBankDate(d)).toBe('05/01/2024')
  })

  it('is the inverse of parseBankDate for valid dates', () => {
    const original = '07/03/2025'
    expect(formatBankDate(parseBankDate(original))).toBe(original)
  })
})

describe('getMonthYear', () => {
  it('extracts month and year from a UTC date', () => {
    const d = new Date(Date.UTC(2024, 5, 15))
    expect(getMonthYear(d)).toEqual({ month: 6, year: 2024 })
  })

  it('returns month 1 for January', () => {
    const d = new Date(Date.UTC(2024, 0, 1))
    expect(getMonthYear(d).month).toBe(1)
  })

  it('returns month 12 for December', () => {
    const d = new Date(Date.UTC(2024, 11, 31))
    expect(getMonthYear(d).month).toBe(12)
  })
})
