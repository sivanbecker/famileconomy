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
  // Handle Date objects from ExcelJS
  if (raw instanceof Date) {
    return isNaN(raw.getTime()) ? null : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate())
  }

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

const CARD_SUFFIX_RE = /המסתיים\s+ב-(\d{4})/

export async function extractCalXlsxCardIdentifiers(buffer: Buffer): Promise<string[]> {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error(`Cal XLSX: expected Buffer, got ${typeof buffer}`)
  }
  if (buffer.length < 4) {
    throw new Error(`Cal XLSX: buffer too small (${buffer.length} bytes)`)
  }

  // Check for ZIP magic bytes
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(
      `Cal XLSX: not a valid ZIP/XLSX file (magic bytes: ${buffer[0]?.toString(16)} ${buffer[1]?.toString(16)})`
    )
  }

  let workbook: ExcelJS.Workbook | undefined
  try {
    // Copy buffer to avoid mutation
    const bufferCopy = Buffer.alloc(buffer.length)
    buffer.copy(bufferCopy)

    workbook = new ExcelJS.Workbook()
    if (!workbook) throw new Error('Failed to create workbook')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(bufferCopy as any)

    if (!workbook.worksheets) {
      throw new Error('Workbook loaded but has no worksheets property')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Cal XLSX: failed to load file - ${msg}`)
  }

  const worksheets = workbook.worksheets
  if (!worksheets || worksheets.length === 0) {
    throw new Error('Cal XLSX: no worksheets found after load')
  }

  const worksheet = worksheets[0]
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
    // Handle newlines in cell content (split on newline and check first line)
    const firstLine = firstCell.split('\n')[0] ?? ''
    if (firstLine.startsWith('תאריך')) {
      return i - 1 // Return 0-based index
    }
  }
  return -1
}

export async function parseCalXlsx(buffer: Buffer): Promise<ParsedTransaction[]> {
  if (!Buffer.isBuffer(buffer)) {
    throw new Error(`Cal XLSX: expected Buffer, got ${typeof buffer}`)
  }
  if (buffer.length < 4) {
    throw new Error(`Cal XLSX: buffer too small (${buffer.length} bytes)`)
  }

  // Check for ZIP magic bytes
  if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) {
    throw new Error(
      `Cal XLSX: not a valid ZIP/XLSX file (magic bytes: ${buffer[0]?.toString(16)} ${buffer[1]?.toString(16)})`
    )
  }

  let workbook: ExcelJS.Workbook | undefined
  try {
    // Copy buffer to avoid mutation
    const bufferCopy = Buffer.alloc(buffer.length)
    buffer.copy(bufferCopy)

    workbook = new ExcelJS.Workbook()
    if (!workbook) throw new Error('Failed to create workbook')

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(bufferCopy as any)

    if (!workbook.worksheets) {
      throw new Error('Workbook loaded but has no worksheets property')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    throw new Error(`Cal XLSX: failed to load file - ${msg}`)
  }

  const worksheets = workbook.worksheets
  if (!worksheets || worksheets.length === 0) {
    throw new Error('Cal XLSX: no worksheets found after load')
  }

  const worksheet = worksheets[0]
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
    const description = String(descriptionCell ?? '')
      .trim()
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
    const categoryCell = row.getCell(COL_CATEGORY + 1).value
    const category =
      String(categoryCell ?? '')
        .trim()
        .replace(/\n/g, ' ')
        .replace(/\s+/g, ' ') || null
    const notesCell = row.getCell(COL_NOTES + 1).value
    const notes = String(notesCell ?? '')
      .trim()
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')

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
