import ExcelJS from 'exceljs'
import { toShekels } from '@famileconomy/utils'
import { parseInstallmentNote } from './installment-parser'
import type { ParsedTransaction } from './types'

// ─── Column indices (0-based) ─────────────────────────────────────────────────

const COL_TX_DATE = 0
const COL_DESCRIPTION = 1
const COL_TX_AMOUNT = 2
const COL_CHARGE_AMOUNT = 3
const COL_CATEGORY = 5
const COL_NOTES = 6

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateDMYY(raw: unknown): Date | null {
  const str = String(raw ?? '').trim()
  if (!str) return null
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(str)
  if (!match) return null
  const [, d, m, yy] = match
  const year = 2000 + parseInt(yy as string, 10)
  const month = parseInt(m as string, 10)
    .toString()
    .padStart(2, '0')
  const day = parseInt(d as string, 10)
    .toString()
    .padStart(2, '0')
  const date = new Date(`${year}-${month}-${day}`)
  return isNaN(date.getTime()) ? null : date
}

function stripCurrencyPrefix(raw: unknown): { value: string; currency: string } {
  const s = String(raw ?? '').trim()
  let currency = 'ILS'
  let rest = s

  if (s.startsWith('₪')) {
    currency = 'ILS'
    rest = s.slice(1)
  } else if (s.startsWith('$')) {
    currency = 'USD'
    rest = s.slice(1)
  } else if (s.startsWith('€')) {
    currency = 'EUR'
    rest = s.slice(1)
  } else if (s.startsWith('£')) {
    currency = 'GBP'
    rest = s.slice(1)
  }

  const value = rest.replace(/,/g, '').trim()
  return { value, currency }
}

function parseCalAmount(raw: unknown): { agorot: number; currency: string } | null {
  if (!raw) return null
  const { value, currency } = stripCurrencyPrefix(raw)
  const n = parseFloat(value)
  if (isNaN(n)) return null
  return { agorot: toShekels(n), currency }
}

// ─── Card identifier extraction ───────────────────────────────────────────────

const CARD_SUFFIX_RE = /המסתיים ב-(\d{4})/

export async function extractCalXlsxCardIdentifiers(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Cal XLSX: no worksheet found')

  const firstRow = worksheet.getRow(1)
  if (!firstRow) throw new Error('Cal XLSX: cannot read first row')

  const firstCell = String(firstRow.getCell(1).value ?? '')
  const match = CARD_SUFFIX_RE.exec(firstCell)
  if (!match) throw new Error('CARD_NOT_FOUND')

  return [match[1] as string]
}

// ─── Charge date extraction ────────────────────────────────────────────────────

const CHARGE_DATE_RE = /עסקאות לחיוב ב-(\d{2})\/(\d{2})\/(\d{4})/

function extractChargeDateFromWorksheet(worksheet: ExcelJS.Worksheet): Date | null {
  for (let i = 1; i <= Math.min(worksheet.rowCount, 10); i++) {
    const row = worksheet.getRow(i)
    const cellValue = String(row.getCell(1).value ?? '')
    const match = CHARGE_DATE_RE.exec(cellValue)
    if (match) {
      const [, dd, mm, yyyy] = match
      const date = new Date(`${yyyy as string}-${mm as string}-${dd as string}`)
      return isNaN(date.getTime()) ? null : date
    }
  }
  return null
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function findHeaderRowIndex(worksheet: ExcelJS.Worksheet): number {
  for (let i = 1; i <= Math.min(worksheet.rowCount, 20); i++) {
    const row = worksheet.getRow(i)
    const firstCell = String(row.getCell(1).value ?? '').trim()
    if (firstCell.startsWith('תאריך')) {
      return i - 1 // Return 0-based index
    }
  }
  return -1
}

export async function parseCalXlsx(buffer: Buffer): Promise<ParsedTransaction[]> {
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Cal XLSX: no worksheet found')

  // Extract card from row 0
  const firstRow = worksheet.getRow(1)
  if (!firstRow) throw new Error('Cal XLSX: cannot read first row')
  const firstCell = String(firstRow.getCell(1).value ?? '')
  const cardMatch = CARD_SUFFIX_RE.exec(firstCell)
  if (!cardMatch) throw new Error('Cal XLSX: card identifier not found')
  const cardLastFour = cardMatch[1] as string

  // Extract charge date
  const chargeDate = extractChargeDateFromWorksheet(worksheet)
  if (!chargeDate) throw new Error('Cal XLSX: charge date not found')

  // Find header row
  const headerRowIndex = findHeaderRowIndex(worksheet)
  if (headerRowIndex === -1) throw new Error('Cal XLSX: column header row not found')

  const results: ParsedTransaction[] = []

  for (let i = headerRowIndex + 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i)
    const dateCell = row.getCell(COL_TX_DATE + 1).value
    if (!dateCell) continue

    const txDate = parseDateDMYY(dateCell)
    if (!txDate) continue

    const descriptionCell = row.getCell(COL_DESCRIPTION + 1).value
    const description = String(descriptionCell ?? '').trim()
    const categoryCell = row.getCell(COL_CATEGORY + 1).value
    const category = String(categoryCell ?? '').trim() || null
    const notesCell = row.getCell(COL_NOTES + 1).value
    const notes = String(notesCell ?? '').trim()

    const txAmountCell = row.getCell(COL_TX_AMOUNT + 1).value
    const txAmountParsed = parseCalAmount(txAmountCell)
    if (!txAmountParsed) continue

    const chargeAmountCell = row.getCell(COL_CHARGE_AMOUNT + 1).value
    const chargeAmountParsed = parseCalAmount(chargeAmountCell)

    const amountAgorot = chargeAmountParsed?.agorot ?? txAmountParsed.agorot
    const originalAmountAgorot = txAmountParsed.agorot
    const originalCurrency = txAmountParsed.currency

    const installment = parseInstallmentNote(notes)
    const isPending = notes.includes('עסקה בקליטה')

    results.push({
      transactionDate: txDate,
      chargeDate: isPending ? null : chargeDate,
      description,
      amountAgorot,
      originalAmountAgorot,
      originalCurrency,
      category,
      cardLastFour,
      installmentNum: installment?.num ?? null,
      installmentOf: installment?.of ?? null,
      isPending,
    })
  }

  return results
}
