import { describe, it, expect } from 'vitest'
import ExcelJS from 'exceljs'
import { parseCalXlsx, extractCalXlsxCardIdentifiers } from '../lib/parsers/cal-xlsx-parser'
import type { ParsedTransaction } from '../lib/parsers/types'

// ─── Fixture helpers ─────────────────────────────────────────────────────────

async function makeCalXlsx(
  cardLastFour: string,
  chargeDate: string,
  ...dataRows: (string | number)[][]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet()

  // Row 1: Card identifier (CAL real-world format includes bank and account details)
  worksheet.addRow([
    `פירוט עסקאות לחשבון מזרחי-טפחות 123-123456 לכרטיס ויזה זהב עסקי המסתיים ב-${cardLastFour}`,
  ])

  // Row 2: Empty or spacing
  worksheet.addRow([])

  // Row 3: Charge date (CAL format: "עסקאות לחיוב ב-DD/MM/YYYY")
  worksheet.addRow([`עסקאות לחיוב ב-${chargeDate}`])

  // Row 4: Empty or spacing
  worksheet.addRow([])

  // Row 5: Header row
  const headerRow = ['תאריך', 'תיאור העסקה', 'סכום עסקה', 'סכום חיוב', '', 'קטגוריה', 'הערות']
  worksheet.addRow(headerRow)

  // Data rows
  dataRows.forEach(row => worksheet.addRow(row))

  const buffer = await workbook.xlsx.writeBuffer()
  return Buffer.from(buffer as ArrayBuffer)
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('parseCalXlsx', () => {
  describe('basic parsing', () => {
    it('parses a simple ILS transaction', async () => {
      const xlsx = await makeCalXlsx('9876', '10/05/2026', [
        '9/4/26',
        'מאפיית בראשית סוקולב 34 ה',
        '₪ 17.00',
        '₪ 17.00',
        '',
        'מסעדות, קפה וברים',
        '',
      ])

      const result = await parseCalXlsx(xlsx)

      expect(result).toHaveLength(1)
      const tx = result[0] as ParsedTransaction
      expect(tx.transactionDate).toEqual(new Date('2026-04-09'))
      expect(tx.chargeDate).toEqual(new Date('2026-05-10'))
      expect(tx.description).toBe('מאפיית בראשית סוקולב 34 ה')
      expect(tx.amountAgorot).toBe(1700)
      expect(tx.originalAmountAgorot).toBe(1700)
      expect(tx.originalCurrency).toBe('ILS')
      expect(tx.category).toBe('מסעדות, קפה וברים')
      expect(tx.cardLastFour).toBe('9876')
    })

    it('parses a decimal amount with thousands separator', async () => {
      const xlsx = await makeCalXlsx('9876', '10/05/2026', [
        '9/4/26',
        'מי הרצליה בעמ',
        '₪ 1,453.90',
        '₪ 1,453.90',
        '',
        'עירייה וממשלה',
        '',
      ])

      const result = await parseCalXlsx(xlsx)
      expect(result[0]?.amountAgorot).toBe(145390)
    })

    it('handles foreign currency transactions', async () => {
      const xlsx = await makeCalXlsx('9876', '10/05/2026', [
        '9/4/26',
        'AMAZON.COM',
        '$ 39.99',
        '₪ 150.00',
        '',
        'קניות אונליין',
        '',
      ])

      const result = await parseCalXlsx(xlsx)
      const tx = result[0] as ParsedTransaction
      expect(tx.amountAgorot).toBe(15000)
      expect(tx.originalAmountAgorot).toBe(3999)
      expect(tx.originalCurrency).toBe('USD')
    })

    it('returns empty array for XLSX with no data rows', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet()
      worksheet.addRow(['כרטיס האשראי המסתיים ב-9876'])
      worksheet.addRow([])
      worksheet.addRow(['עסקאות לחיוב ב-10/05/2026'])
      worksheet.addRow([])
      const headerRow = ['תאריך', 'תיאור העסקה', 'סכום עסקה', 'סכום חיוב', '', 'קטגוריה', 'הערות']
      worksheet.addRow(headerRow)
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      const result = await parseCalXlsx(xlsx)
      expect(result).toHaveLength(0)
    })
  })

  describe('pending transactions', () => {
    it('marks transaction as pending when notes include "עסקה בקליטה"', async () => {
      const xlsx = await makeCalXlsx('9876', '10/05/2026', [
        '9/4/26',
        'מאפיית בראשית',
        '₪ 17.00',
        '₪ 17.00',
        '',
        'מסעדות',
        'עסקה בקליטה',
      ])

      const result = await parseCalXlsx(xlsx)
      const tx = result[0] as ParsedTransaction
      expect(tx.isPending).toBe(true)
      expect(tx.chargeDate).toBeNull()
    })

    it('marks transaction as cleared when notes do not include "עסקה בקליטה"', async () => {
      const xlsx = await makeCalXlsx('9876', '10/05/2026', [
        '9/4/26',
        'מאפיית בראשית',
        '₪ 17.00',
        '₪ 17.00',
        '',
        'מסעדות',
        '',
      ])

      const result = await parseCalXlsx(xlsx)
      const tx = result[0] as ParsedTransaction
      expect(tx.isPending).toBe(false)
      expect(tx.chargeDate).toEqual(new Date('2026-05-10'))
    })
  })

  describe('installment detection', () => {
    it('detects installment info from notes field', async () => {
      const xlsx = await makeCalXlsx('9876', '10/05/2026', [
        '30/7/25',
        'קיי.אס.פי הרצליה מרכז בעמ',
        '₪ 309.00',
        '₪ 309.00',
        '',
        'חשמל ומחשבים',
        'תשלום 10 מתוך 15',
      ])

      const result = await parseCalXlsx(xlsx)
      const tx = result[0] as ParsedTransaction
      expect(tx.installmentNum).toBe(10)
      expect(tx.installmentOf).toBe(15)
    })
  })

  describe('error handling', () => {
    it('throws error when card identifier is missing', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet()
      worksheet.addRow(['some random data'])
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      await expect(parseCalXlsx(xlsx)).rejects.toThrow()
    })

    it('throws error when charge date is missing', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet()
      worksheet.addRow(['כרטיס האשראי המסתיים ב-9876'])
      worksheet.addRow([])
      worksheet.addRow(['some random data'])
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      await expect(parseCalXlsx(xlsx)).rejects.toThrow()
    })

    it('throws error when header row is missing', async () => {
      const workbook = new ExcelJS.Workbook()
      const worksheet = workbook.addWorksheet()
      worksheet.addRow(['כרטיס האשראי המסתיים ב-9876'])
      worksheet.addRow([])
      worksheet.addRow(['עסקאות לחיוב ב-10/05/2026'])
      const buffer = await workbook.xlsx.writeBuffer()
      const xlsx = Buffer.from(buffer as ArrayBuffer)

      await expect(parseCalXlsx(xlsx)).rejects.toThrow()
    })
  })
})

describe('extractCalXlsxCardIdentifiers', () => {
  it('extracts card identifier from CAL XLSX', async () => {
    const xlsx = await makeCalXlsx('9876', '10/05/2026', [
      '9/4/26',
      'מאפיית בראשית',
      '₪ 17.00',
      '₪ 17.00',
      '',
      'מסעדות',
      '',
    ])

    const identifiers = await extractCalXlsxCardIdentifiers(xlsx)
    expect(identifiers).toEqual(['9876'])
  })

  it('throws error when card identifier is missing', async () => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet()
    worksheet.addRow(['some random data'])
    const buffer = await workbook.xlsx.writeBuffer()
    const xlsx = Buffer.from(buffer as ArrayBuffer)

    await expect(extractCalXlsxCardIdentifiers(xlsx)).rejects.toThrow()
  })
})
