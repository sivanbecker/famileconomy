import ExcelJS from 'exceljs'
import { toShekels } from '@famileconomy/utils'
import { parseInstallmentNote } from './installment-parser'
import type { ParsedTransaction } from './types'

// ─── Column indices (0-based) ─────────────────────────────────────────────────

const COL_TX_DATE = 0
const COL_DESCRIPTION = 1
const COL_CATEGORY = 2
const COL_CARD_LAST_FOUR = 3
const COL_AMOUNT = 5
const COL_ORIGINAL_AMOUNT = 7
const COL_ORIGINAL_CURRENCY = 8
const COL_CHARGE_DATE = 9
const COL_NOTES = 10

const COLUMN_HEADER_MARKER = 'תאריך עסקה'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDateDMY(raw: unknown): Date | null {
  const str = String(raw ?? '').trim()
  if (!str) return null
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(str)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = new Date(`${yyyy}-${mm}-${dd}`)
  return isNaN(d.getTime()) ? null : d
}

function parseAmount(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw ?? 0).trim())
  if (isNaN(n)) throw new Error(`Invalid amount: "${raw}"`)
  return toShekels(Math.abs(n)) * (n < 0 ? -1 : 1)
}

function normaliseCurrency(symbol: unknown): string {
  const s = String(symbol ?? '₪').trim()
  if (s === '₪') return 'ILS'
  if (s === '$') return 'USD'
  if (s === '€') return 'EUR'
  if (s === '£') return 'GBP'
  return s
}

function normaliseDescription(raw: unknown): string {
  const s = String(raw ?? '').trim()
  return s.replace(/\s+/g, ' ')
}

// ─── Card identifier extraction ───────────────────────────────────────────────

export async function extractMaxXlsxCardIdentifiers(buffer: Buffer): Promise<string[]> {
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Max XLSX: no worksheet found')

  const headerRowIndex = findHeaderRowIndex(worksheet)
  if (headerRowIndex === -1) throw new Error('Max XLSX: column header row not found')

  const seen = new Set<string>()
  for (let i = headerRowIndex + 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i)
    const cellValue = row.getCell(COL_CARD_LAST_FOUR + 1).value
    const card = String(cellValue ?? '').trim()
    // Skip empty rows and the header text itself
    if (card && card.length > 0 && !card.startsWith('ספרות') && card !== '4') {
      seen.add(card)
    }
  }

  return Array.from(seen)
}

// ─── Parser ───────────────────────────────────────────────────────────────────

function findHeaderRowIndex(worksheet: ExcelJS.Worksheet): number {
  for (let i = 1; i <= Math.min(worksheet.rowCount, 20); i++) {
    const row = worksheet.getRow(i)
    const firstCell = String(row.getCell(1).value ?? '').trim()
    if (firstCell.startsWith(COLUMN_HEADER_MARKER)) {
      return i - 1 // Return 0-based index
    }
  }
  return -1
}

export async function parseMaxXlsx(buffer: Buffer): Promise<ParsedTransaction[]> {
  const workbook = new ExcelJS.Workbook()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any)

  const worksheet = workbook.worksheets[0]
  if (!worksheet) throw new Error('Max XLSX: no worksheet found')

  const headerRowIndex = findHeaderRowIndex(worksheet)
  if (headerRowIndex === -1) throw new Error('Max XLSX: column header row not found')

  const results: ParsedTransaction[] = []

  for (let i = headerRowIndex + 2; i <= worksheet.rowCount; i++) {
    const row = worksheet.getRow(i)
    const dateCell = row.getCell(COL_TX_DATE + 1).value
    if (!dateCell) continue

    const txDate = parseDateDMY(dateCell)
    if (!txDate) continue

    const chargeDateCell = row.getCell(COL_CHARGE_DATE + 1).value
    const chargeDate = parseDateDMY(chargeDateCell ?? '')
    const descriptionCell = row.getCell(COL_DESCRIPTION + 1).value
    const description = normaliseDescription(descriptionCell ?? '')
    const categoryCell = row.getCell(COL_CATEGORY + 1).value
    const category = String(categoryCell ?? '').trim() || null
    const cardCell = row.getCell(COL_CARD_LAST_FOUR + 1).value
    const cardLastFour = String(cardCell ?? '').trim() || null
    const notesCell = row.getCell(COL_NOTES + 1).value
    const notes = String(notesCell ?? '').trim()

    const amountCell = row.getCell(COL_AMOUNT + 1).value
    const amountAgorot = parseAmount(amountCell ?? 0)

    const rawOriginal = row.getCell(COL_ORIGINAL_AMOUNT + 1).value
    const origAmount =
      typeof rawOriginal === 'number' ? rawOriginal : parseFloat(String(rawOriginal ?? 0))
    const amountValue = row.getCell(COL_AMOUNT + 1).value
    const originalSign = typeof amountValue === 'number' && amountValue < 0 ? -1 : 1
    const originalAmountAgorot = isNaN(origAmount)
      ? Math.abs(amountAgorot)
      : toShekels(origAmount) * originalSign

    const currencyCell = row.getCell(COL_ORIGINAL_CURRENCY + 1).value
    const originalCurrency = normaliseCurrency(currencyCell ?? '₪')

    const installment = parseInstallmentNote(notes)

    results.push({
      transactionDate: txDate,
      chargeDate,
      description,
      amountAgorot,
      originalAmountAgorot,
      originalCurrency,
      category,
      cardLastFour,
      installmentNum: installment?.num ?? null,
      installmentOf: installment?.of ?? null,
      isPending: false,
      notes: notes || null,
    })
  }

  return results
}
