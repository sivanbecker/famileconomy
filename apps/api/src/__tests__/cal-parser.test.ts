import { describe, it, expect } from 'vitest'
import { parseCalCsv } from '../lib/parsers/cal-parser'
import type { ParsedTransaction } from '../lib/parsers/types'

// ─── Fixture helpers ──────────────────────────────────────────────────────────

const HEADER = `פירוט עסקאות לחשבון מזרחי-טפחות 123-123456 לכרטיס ויזה זהב עסקי המסתיים ב-1234,,,,,,
,,,,,,
"עסקאות לחיוב ב-10/05/2026: 3,573.34 ₪",,,,,,
עסקאות בתהליך קליטה 442.67 ₪,,,,,,
"תאריך
עסקה",שם בית עסק,"סכום
עסקה","סכום
חיוב","סוג
עסקה",ענף,הערות`

const FOOTER = `,,,,,,
את המידע המלא על כל עסקה אפשר למצוא באתר ובאפליקציית כאל. מידע על חיובים בבנק נמצא בתפריט תחת ''סיכום חיובים בבנק'',,,,,,`

const makeCsv = (...dataRows: string[]) => [HEADER, ...dataRows, FOOTER].join('\n')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseCalCsv', () => {
  describe('basic parsing', () => {
    it('parses a simple cleared ILS transaction', () => {
      const csv = makeCsv('24/4/26,א.י קמעונאות מזון וסחר בע,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,')
      const result = parseCalCsv(csv)

      expect(result).toHaveLength(1)
      const tx = result[0] as ParsedTransaction
      expect(tx.transactionDate).toEqual(new Date('2026-04-24'))
      expect(tx.description).toBe('א.י קמעונאות מזון וסחר בע')
      expect(tx.amountAgorot).toBe(26462)
      expect(tx.originalAmountAgorot).toBe(26462)
      expect(tx.originalCurrency).toBe('ILS')
      expect(tx.category).toBe('מזון ומשקאות')
      expect(tx.installmentNum).toBeNull()
      expect(tx.installmentOf).toBeNull()
    })

    it('uses the charge amount (col 3) as amountAgorot when available', () => {
      // installment: original=1734, charge=578 (1 of 3)
      const csv = makeCsv(
        '24/4/26,עיריית הרצליה,"₪ 1,734.00",₪ 578.00,תשלומים,מוסדות,תשלום 1 מתוך 3'
      )
      const result = parseCalCsv(csv)
      expect(result[0]?.amountAgorot).toBe(57800)
    })

    it('falls back to transaction amount when charge amount is empty (pending)', () => {
      const csv = makeCsv('26/4/26,פרשמרקט,₪ 192.67,,רכישה רגילה,מזון ומשקאות,עסקה בקליטה')
      const result = parseCalCsv(csv)
      expect(result[0]?.amountAgorot).toBe(19267)
    })

    it('parses originalAmountAgorot from the transaction amount column', () => {
      const csv = makeCsv(
        '24/4/26,עיריית הרצליה,"₪ 1,734.00",₪ 578.00,תשלומים,מוסדות,תשלום 1 מתוך 3'
      )
      const result = parseCalCsv(csv)
      expect(result[0]?.originalAmountAgorot).toBe(173400)
    })

    it('parses the date in D/M/YY format (single-digit day)', () => {
      const csv = makeCsv('9/4/26,גרעיני עפולה חממה - הרצליה,₪ 123.48,₪ 123.48,רגילה,מזון ומשקאות,')
      const result = parseCalCsv(csv)
      expect(result[0]?.transactionDate).toEqual(new Date('2026-04-09'))
    })

    it('sets chargeDate to null (Cal does not export a charge date column)', () => {
      const csv = makeCsv('24/4/26,א.י קמעונאות מזון,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,')
      const result = parseCalCsv(csv)
      expect(result[0]?.chargeDate).toBeNull()
    })

    it('sets cardLastFour to null (not present per-row in Cal exports)', () => {
      const csv = makeCsv('24/4/26,א.י קמעונאות מזון,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,')
      const result = parseCalCsv(csv)
      expect(result[0]?.cardLastFour).toBeNull()
    })
  })

  describe('amounts with thousands separators', () => {
    it('parses amounts with comma thousands separator (₪ 1,734.00)', () => {
      const csv = makeCsv('24/4/26,עיריית הרצליה,"₪ 1,734.00",₪ 578.00,תשלומים,מוסדות,')
      const result = parseCalCsv(csv)
      expect(result[0]?.originalAmountAgorot).toBe(173400)
    })

    it('parses large amounts (₪ 4,800.00)', () => {
      const csv = makeCsv(
        '20/4/25,חנות - שטראוס מים,"₪ 4,800.00",₪ 95.00,תשלומים,ריהוט ובית,תשלום 13 מתוך 48'
      )
      const result = parseCalCsv(csv)
      expect(result[0]?.originalAmountAgorot).toBe(480000)
      expect(result[0]?.amountAgorot).toBe(9500)
    })
  })

  describe('foreign currency', () => {
    it('parses a USD transaction — charge is ILS, original is USD', () => {
      // original: $33.45, charge: ₪101.22
      const csv = makeCsv('14/4/26,PAYPAL *AISGECOMMER,$ 33.45,₪ 101.22,רגילה,,')
      const result = parseCalCsv(csv)
      const tx = result[0] as ParsedTransaction
      expect(tx.amountAgorot).toBe(10122)
      expect(tx.originalAmountAgorot).toBe(3345)
      expect(tx.originalCurrency).toBe('USD')
    })
  })

  describe('installment detection', () => {
    it('detects installment info from the notes column', () => {
      const csv = makeCsv(
        '24/4/26,עיריית הרצליה,"₪ 1,734.00",₪ 578.00,תשלומים,מוסדות,תשלום 1 מתוך 3'
      )
      const result = parseCalCsv(csv)
      const tx = result[0] as ParsedTransaction
      expect(tx.installmentNum).toBe(1)
      expect(tx.installmentOf).toBe(3)
    })

    it('sets installments to null for non-installment notes', () => {
      const csv = makeCsv('26/4/26,פרשמרקט,₪ 192.67,,רכישה רגילה,מזון ומשקאות,עסקה בקליטה')
      const result = parseCalCsv(csv)
      expect(result[0]?.installmentNum).toBeNull()
      expect(result[0]?.installmentOf).toBeNull()
    })

    it('parses installment 13 of 48 (long-term installment)', () => {
      const csv = makeCsv(
        '20/4/25,חנות - שטראוס מים,"₪ 4,800.00",₪ 95.00,תשלומים,ריהוט ובית,תשלום 13 מתוך 48'
      )
      const result = parseCalCsv(csv)
      expect(result[0]?.installmentNum).toBe(13)
      expect(result[0]?.installmentOf).toBe(48)
    })
  })

  describe('empty / edge cases', () => {
    it('returns empty array when there are no data rows', () => {
      const csv = makeCsv()
      expect(parseCalCsv(csv)).toHaveLength(0)
    })

    it('throws on completely empty string', () => {
      expect(() => parseCalCsv('')).toThrow()
    })

    it('throws when the column header row is missing', () => {
      expect(() => parseCalCsv('garbage,data\n1,2,3')).toThrow()
    })

    it('skips rows with an empty/blank date column', () => {
      const csv = makeCsv(
        ',,,,,,',
        '24/4/26,א.י קמעונאות מזון,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,'
      )
      const result = parseCalCsv(csv)
      expect(result).toHaveLength(1)
    })
  })

  describe('full fixture', () => {
    it('parses all 20 transaction rows from the sample file', async () => {
      const { readFile } = await import('node:fs/promises')
      const { resolve } = await import('node:path')
      const csv = await readFile(
        resolve(__dirname, '../../../../examples/cal monthly report example.csv'),
        'utf-8'
      )
      const result = parseCalCsv(csv)
      expect(result).toHaveLength(20)
    })
  })
})
