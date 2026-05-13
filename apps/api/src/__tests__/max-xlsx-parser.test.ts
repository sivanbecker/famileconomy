import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseMaxXlsx, extractMaxXlsxCardIdentifiers } from '../lib/parsers/max-xlsx-parser'
import type { ParsedTransaction } from '../lib/parsers/types'

// ─── Fixture helpers ─────────────────────────────────────────────────────────

async function makeMaxXlsx(...dataRows: (string | number)[][]): Promise<Buffer> {
  const headerRow = [
    'תאריך עסקה',
    'שם בית העסק',
    'קטגוריה',
    '4 ספרות אחרונות של כרטיס האשראי',
    'סוג עסקה',
    'סכום חיוב',
    'מטבע חיוב',
    'סכום עסקה מקורי',
    'מטבע עסקה מקורי',
    'תאריך חיוב',
    'הערות',
  ]

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet()

  worksheet.addRow(headerRow)
  dataRows.forEach(row => worksheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as ArrayBuffer)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseMaxXlsx', () => {
  describe('basic parsing', () => {
    it('parses a simple ILS transaction', async () => {
      const xlsx = await makeMaxXlsx([
        '09-04-2026',
        'מאפיית בראשית סוקולב 34 ה',
        'מסעדות, קפה וברים',
        '5432',
        'רגילה',
        17,
        '₪',
        17,
        '₪',
        '10-05-2026',
        '',
      ])

      const result = await parseMaxXlsx(xlsx)

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

    it('parses a decimal amount correctly (no float drift)', async () => {
      const xlsx = await makeMaxXlsx([
        '09-04-2026',
        'מי הרצליה בעמ',
        'עירייה וממשלה',
        '5432',
        'רגילה',
        453.9,
        '₪',
        453.9,
        '₪',
        '10-05-2026',
        'הוראת קבע',
      ])

      const result = await parseMaxXlsx(xlsx)
      expect(result[0]?.amountAgorot).toBe(45390)
    })

    it('parses a negative amount (cancellation) as negative agorot', async () => {
      const xlsx = await makeMaxXlsx([
        '09-04-2026',
        'ZLLIHC',
        'פנאי, בידור וספורט',
        '5432',
        'רגילה',
        -176,
        '₪',
        176,
        '₪',
        '10-05-2026',
        'ביטול עסקה',
      ])

      const result = await parseMaxXlsx(xlsx)
      expect(result[0]?.amountAgorot).toBe(-17600)
    })

    it('handles foreign currency transactions', async () => {
      const xlsx = await makeMaxXlsx([
        '09-04-2026',
        'AMAZON.COM',
        'קניות אונליין',
        '5432',
        'רגילה',
        29.99,
        '₪',
        39.99,
        '$',
        '10-05-2026',
        '',
      ])

      const result = await parseMaxXlsx(xlsx)
      const tx = result[0] as ParsedTransaction
      expect(tx.amountAgorot).toBe(2999)
      expect(tx.originalAmountAgorot).toBe(3999)
      expect(tx.originalCurrency).toBe('USD')
    })

    it('returns empty array for XLSX with no data rows', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet()
      const headerRow = [
        'תאריך עסקה',
        'שם בית העסק',
        'קטגוריה',
        '4 ספרות אחרונות של כרטיס האשראי',
        'סוג עסקה',
        'סכום חיוב',
        'מטבע חיוב',
        'סכום עסקה מקורי',
        'מטבע עסקה מקורי',
        'תאריך חיוב',
        'הערות',
      ]
      worksheet.addRow(headerRow)
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      const result = await parseMaxXlsx(xlsx)
      expect(result).toHaveLength(0)
    })
  })

  describe('installment detection', () => {
    it('detects installment info from notes field', async () => {
      const xlsx = await makeMaxXlsx([
        '30-07-2025',
        'קיי.אס.פי הרצליה מרכז בעמ',
        'חשמל ומחשבים',
        '0017',
        'תשלומים',
        309,
        '₪',
        4642,
        '₪',
        '10-05-2026',
        'תשלום 10 מתוך 15',
      ])

      const result = await parseMaxXlsx(xlsx)
      const tx = result[0] as ParsedTransaction
      expect(tx.installmentNum).toBe(10)
      expect(tx.installmentOf).toBe(15)
    })
  })

  describe('multiple cards', () => {
    it('extracts transactions from multiple cards', async () => {
      const xlsx = await makeMaxXlsx(
        [
          '09-04-2026',
          'מאפיית בראשית',
          'מסעדות',
          '5432',
          'רגילה',
          17,
          '₪',
          17,
          '₪',
          '10-05-2026',
          '',
        ],
        ['10-04-2026', 'בקר בשר', 'מסעדות', '9876', 'רגילה', 50, '₪', 50, '₪', '10-05-2026', '']
      )

      const result = await parseMaxXlsx(xlsx)
      expect(result).toHaveLength(2)
      expect(result[0]?.cardLastFour).toBe('5432')
      expect(result[1]?.cardLastFour).toBe('9876')
    })
  })

  describe('notes field', () => {
    it('stores raw notes text on the parsed transaction', async () => {
      const xlsx = await makeMaxXlsx([
        '13-04-2026',
        'PAYBOX TEL AVIV IL',
        'העברת כספים',
        '5432',
        'רגילה',
        30,
        '₪',
        30,
        '₪',
        '10-05-2026',
        'למי: יובל בקר',
      ])
      const result = await parseMaxXlsx(xlsx)
      expect(result[0]?.notes).toBe('למי: יובל בקר')
    })

    it('stores null when the notes cell is empty', async () => {
      const xlsx = await makeMaxXlsx([
        '09-04-2026',
        'מאפיית בראשית',
        'שונות',
        '5432',
        'רגילה',
        17,
        '₪',
        17,
        '₪',
        '10-05-2026',
        '',
      ])
      const result = await parseMaxXlsx(xlsx)
      expect(result[0]?.notes).toBeNull()
    })
  })

  describe('error handling', () => {
    it('throws error for empty XLSX file', async () => {
      const workbook = new ExcelJS.Workbook()
      workbook.addWorksheet()
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      await expect(parseMaxXlsx(xlsx)).rejects.toThrow()
    })

    it('throws error when header row is missing', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet()
      worksheet.addRow(['some', 'random', 'data'])
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      await expect(parseMaxXlsx(xlsx)).rejects.toThrow()
    })
  })
})

describe('extractMaxXlsxCardIdentifiers', () => {
  it('extracts unique card identifiers from XLSX', async () => {
    const xlsx = await makeMaxXlsx(
      [
        '09-04-2026',
        'מאפיית בראשית',
        'מסעדות',
        '5432',
        'רגילה',
        17,
        '₪',
        17,
        '₪',
        '10-05-2026',
        '',
      ],
      ['10-04-2026', 'בקר בשר', 'מסעדות', '9876', 'רגילה', 50, '₪', 50, '₪', '10-05-2026', ''],
      ['11-04-2026', 'קפה ביתי', 'קפה', '5432', 'רגילה', 15, '₪', 15, '₪', '10-05-2026', '']
    )

    const identifiers = await extractMaxXlsxCardIdentifiers(xlsx)
    expect(identifiers).toContain('5432')
    expect(identifiers).toContain('9876')
    expect(identifiers).toHaveLength(2)
  })

  it('returns empty array when no valid card identifiers found', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet()
    const headerRow = [
      'תאריך עסקה',
      'שם בית העסק',
      'קטגוריה',
      '4 ספרות אחרונות של כרטיס האשראי',
      'סוג עסקה',
      'סכום חיוב',
      'מטבע חיוב',
      'סכום עסקה מקורי',
      'מטבע עסקה מקורי',
      'תאריך חיוב',
      'הערות',
    ]
    worksheet.addRow(headerRow)
    const buffer = await workbook.xlsx.writeBuffer()
    const xlsx = Buffer.from(buffer as ArrayBuffer)

    const identifiers = await extractMaxXlsxCardIdentifiers(xlsx)
    expect(identifiers).toHaveLength(0)
  })
})
