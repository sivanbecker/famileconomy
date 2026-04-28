import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseMaxCsv } from '../lib/parsers/max-parser'
import type { ParsedTransaction } from '../lib/parsers/types'

// ─── Fixture ─────────────────────────────────────────────────────────────────

const HEADER_ROWS = `כל המשתמשים (2),,,,,,,,,,,,,,,
כל הכרטיסים (5),,,,,,,,,,,,,,,
05/2026,,,,,,,,,,,,,,,
תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"`

const makeCsv = (...dataRows: string[]) =>
  [
    HEADER_ROWS,
    ...dataRows,
    ',,,,,,,,,,,,,,,',
    'סך הכל,,,,,,,,,,,,,,,',
    '4843.61₪,,,,,,,,,,,,,,,',
  ].join('\n')

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseMaxCsv', () => {
  describe('basic parsing', () => {
    it('parses a simple ILS transaction', () => {
      const csv = makeCsv(
        '09-04-2026,מאפיית בראשית סוקולב 34 ה,"מסעדות, קפה וברים",5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,'
      )
      const result = parseMaxCsv(csv)

      expect(result).toHaveLength(1)
      const tx = result[0] as ParsedTransaction
      expect(tx.transactionDate).toEqual(new Date('2026-04-09'))
      expect(tx.chargeDate).toEqual(new Date('2026-05-10'))
      expect(tx.description).toBe('מאפיית בראשית סוקולב 34 ה')
      expect(tx.amountAgorot).toBe(1700)
      expect(tx.originalAmountAgorot).toBe(1700)
      expect(tx.originalCurrency).toBe('ILS')
      expect(tx.category).toBe('מסעדות, קפה וברים')
      expect(tx.cardLastFour).toBe('5432')
    })

    it('parses a decimal amount correctly (no float drift)', () => {
      const csv = makeCsv(
        '09-04-2026,מי הרצליה בעמ,עירייה וממשלה,5432,רגילה,453.9,₪,453.9,₪,10-05-2026,הוראת קבע,,,,טלפוני,'
      )
      const result = parseMaxCsv(csv)
      expect(result[0]?.amountAgorot).toBe(45390)
    })

    it('parses a negative amount (cancellation) as negative agorot', () => {
      const csv = makeCsv(
        '09-04-2026,ZLLIHC,"פנאי, בידור וספורט",5432,רגילה,-176,₪,176,₪,10-05-2026,ביטול עסקה,,,,טלפוני,'
      )
      const result = parseMaxCsv(csv)
      expect(result[0]?.amountAgorot).toBe(-17600)
    })

    it('trims whitespace from merchant names', () => {
      const csv = makeCsv(
        '13-04-2026,PAYBOX                 TEL AVIV      IL,העברת כספים,5432,רגילה,30,₪,30,₪,10-05-2026,למי: יובל בקר,,,,טלפוני,'
      )
      const result = parseMaxCsv(csv)
      expect(result[0]?.description).toBe('PAYBOX TEL AVIV IL')
    })

    it('handles merchant names with embedded quotes', () => {
      const csv = makeCsv(
        '10-04-2026,"דיין גרופ בע""מ",קוסמטיקה וטיפוח,5432,רגילה,38.5,₪,38.5,₪,10-05-2026,,,,,,'
      )
      const result = parseMaxCsv(csv)
      expect(result[0]?.description).toBe('דיין גרופ בע"מ')
    })

    it('strips footer/totals rows and returns only transactions', () => {
      const csv = makeCsv(
        "09-04-2026,בונז'ור,מזון וצריכה,5432,רגילה,10,₪,10,₪,10-05-2026,,,,,תשלום בנייד,",
        "09-04-2026,בונז'ור,מזון וצריכה,5432,רגילה,10,₪,10,₪,10-05-2026,,,,,תשלום בנייד,"
      )
      const result = parseMaxCsv(csv)
      expect(result).toHaveLength(2)
    })
  })

  describe('installment detection', () => {
    it('detects installment info from notes field (תשלום X מתוך Y)', () => {
      const csv = makeCsv(
        '30-07-2025,קיי.אס.פי הרצליה מרכז בעמ,חשמל ומחשבים,0017,תשלומים,309,₪,4642,₪,10-05-2026,תשלום 10 מתוך 15,,,,אינטרנט,'
      )
      const result = parseMaxCsv(csv)
      const tx = result[0] as ParsedTransaction
      expect(tx.installmentNum).toBe(10)
      expect(tx.installmentOf).toBe(15)
    })

    it('sets installmentNum/installmentOf to null when not an installment', () => {
      const csv = makeCsv('09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,')
      const result = parseMaxCsv(csv)
      const tx = result[0] as ParsedTransaction
      expect(tx.installmentNum).toBeNull()
      expect(tx.installmentOf).toBeNull()
    })

    it('parses original amount for installment transactions', () => {
      const csv = makeCsv(
        '30-07-2025,קיי.אס.פי הרצליה מרכז בעמ,חשמל ומחשבים,0017,תשלומים,309,₪,4642,₪,10-05-2026,תשלום 10 מתוך 15,,,,אינטרנט,'
      )
      const result = parseMaxCsv(csv)
      const tx = result[0] as ParsedTransaction
      // charge amount: 309 ILS → 30900 agorot
      expect(tx.amountAgorot).toBe(30900)
      // original (total purchase) amount: 4642 ILS → 464200 agorot
      expect(tx.originalAmountAgorot).toBe(464200)
    })
  })

  describe('foreign currency', () => {
    it('parses a USD transaction with exchange rate column', () => {
      // chargeAmount = 370 ILS, originalAmount = 100 USD
      const csv = makeCsv(
        '01-04-2026,AMAZON.COM,שונות,5432,רגילה,370,₪,100,$,10-05-2026,,,,,אינטרנט,3.70'
      )
      const result = parseMaxCsv(csv)
      const tx = result[0] as ParsedTransaction
      expect(tx.amountAgorot).toBe(37000)
      expect(tx.originalAmountAgorot).toBe(10000)
      expect(tx.originalCurrency).toBe('USD')
    })
  })

  describe('empty / edge cases', () => {
    it('returns empty array for CSV with only headers and footer', () => {
      const csv = makeCsv()
      expect(parseMaxCsv(csv)).toHaveLength(0)
    })

    it('throws on completely empty string', () => {
      expect(() => parseMaxCsv('')).toThrow()
    })

    it('throws when the column header row is missing', () => {
      expect(() => parseMaxCsv('garbage,data\n1,2,3')).toThrow()
    })

    it('skips rows where the date column is not a valid date', () => {
      const csv = makeCsv(
        ',,,,,,,,,,,,,,,',
        "09-04-2026,בונז'ור,מזון וצריכה,5432,רגילה,10,₪,10,₪,10-05-2026,,,,,תשלום בנייד,"
      )
      const result = parseMaxCsv(csv)
      expect(result).toHaveLength(1)
    })
  })

  describe('full fixture', () => {
    const fixturePath = resolve(__dirname, '../../../../examples/max-monthly-report-example.csv')
    it.skipIf(!existsSync(fixturePath))(
      'parses all 37 transaction rows from the sample file',
      async () => {
        const { readFile } = await import('node:fs/promises')
        const csv = await readFile(fixturePath, 'utf-8')
        const result = parseMaxCsv(csv)
        expect(result).toHaveLength(37)
      }
    )
  })
})
