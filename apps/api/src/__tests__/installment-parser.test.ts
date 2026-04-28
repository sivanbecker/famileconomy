import { describe, it, expect } from 'vitest'
import { parseInstallmentNote } from '../lib/parsers/installment-parser'

describe('parseInstallmentNote', () => {
  describe('valid patterns', () => {
    it('parses "תשלום 10 מתוך 15"', () => {
      expect(parseInstallmentNote('תשלום 10 מתוך 15')).toEqual({ num: 10, of: 15 })
    })

    it('parses "תשלום 1 מתוך 1" (single-payment installment)', () => {
      expect(parseInstallmentNote('תשלום 1 מתוך 1')).toEqual({ num: 1, of: 1 })
    })

    it('parses "תשלום 2 מתוך 3"', () => {
      expect(parseInstallmentNote('תשלום 2 מתוך 3')).toEqual({ num: 2, of: 3 })
    })

    it('parses "תשלום 4 מתוך 9"', () => {
      expect(parseInstallmentNote('תשלום 4 מתוך 9')).toEqual({ num: 4, of: 9 })
    })

    it('parses "תשלום 3 מתוך 12"', () => {
      expect(parseInstallmentNote('תשלום 3 מתוך 12')).toEqual({ num: 3, of: 12 })
    })

    it('parses "תשלום 2 מתוך 20"', () => {
      expect(parseInstallmentNote('תשלום 2 מתוך 20')).toEqual({ num: 2, of: 20 })
    })
  })

  describe('edge cases', () => {
    it('returns null for empty string', () => {
      expect(parseInstallmentNote('')).toBeNull()
    })

    it('returns null for unrelated notes (הוראת קבע)', () => {
      expect(parseInstallmentNote('הוראת קבע')).toBeNull()
    })

    it('returns null for ביטול עסקה', () => {
      expect(parseInstallmentNote('ביטול עסקה')).toBeNull()
    })

    it('returns null for transfer notes (למי: ...)', () => {
      expect(parseInstallmentNote('למי: יובל בקר')).toBeNull()
    })

    it('returns null when num > of (malformed data)', () => {
      expect(parseInstallmentNote('תשלום 5 מתוך 3')).toBeNull()
    })

    it('returns null when num is 0', () => {
      expect(parseInstallmentNote('תשלום 0 מתוך 12')).toBeNull()
    })

    it('returns null when of is 0', () => {
      expect(parseInstallmentNote('תשלום 1 מתוך 0')).toBeNull()
    })

    it('handles surrounding whitespace', () => {
      expect(parseInstallmentNote('  תשלום 2 מתוך 6  ')).toEqual({ num: 2, of: 6 })
    })
  })
})
