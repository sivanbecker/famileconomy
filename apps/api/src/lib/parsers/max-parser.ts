/* eslint-disable security/detect-object-injection */
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

function parseDateDMY(raw: string): Date | null {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw.trim())
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const d = new Date(`${yyyy}-${mm}-${dd}`)
  return isNaN(d.getTime()) ? null : d
}

function parseAmount(raw: string): number {
  const n = parseFloat(raw.trim())
  if (isNaN(n)) throw new Error(`Invalid amount: "${raw}"`)
  return toShekels(Math.abs(n)) * (n < 0 ? -1 : 1)
}

function normaliseCurrency(symbol: string): string {
  const s = symbol.trim()
  if (s === '₪') return 'ILS'
  if (s === '$') return 'USD'
  if (s === '€') return 'EUR'
  if (s === '£') return 'GBP'
  return s
}

// Collapse internal runs of whitespace to a single space (PAYBOX merchant names).
function normaliseDescription(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim()
}

// ─── Card identifier extraction ───────────────────────────────────────────────

export function extractMaxCardIdentifiers(csv: string): string[] {
  if (!csv.trim()) throw new Error('CSV is empty')

  const lines = csv.split('\n').map(l => l.trimEnd())
  const headerIdx = lines.findIndex(l => l.startsWith(COLUMN_HEADER_MARKER))
  if (headerIdx === -1) throw new Error('Max CSV: column header row not found')

  const seen = new Set<string>()
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''
    if (!line.trim() || line.startsWith('סך הכל') || /^[\d.,]+₪/.test(line)) break
    const cols = splitCsvLine(line)
    const card = (cols[COL_CARD_LAST_FOUR] ?? '').trim()
    if (card) seen.add(card)
  }
  return Array.from(seen)
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Split a CSV line respecting RFC-4180 quoting (handles embedded commas and
 * doubled-quote escapes as produced by the Max export).
 */
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string
    if (inQuote) {
      if (ch === '"') {
        // Doubled quote → literal quote; end of quoted field otherwise
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuote = false
        }
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuote = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

export function parseMaxCsv(csv: string): ParsedTransaction[] {
  if (!csv.trim()) throw new Error('CSV is empty')

  const lines = csv.split('\n').map(l => l.trimEnd())

  // Find the column header row (contains 'תאריך עסקה')
  const headerIdx = lines.findIndex(l => l.startsWith(COLUMN_HEADER_MARKER))
  if (headerIdx === -1) throw new Error('Max CSV: column header row not found')

  const results: ParsedTransaction[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i] ?? ''

    // Stop at the blank separator row before the totals footer
    if (!line.trim() || line.startsWith('סך הכל') || /^[\d.,]+₪/.test(line)) break

    const cols = splitCsvLine(line)

    const txDate = parseDateDMY(cols[COL_TX_DATE] ?? '')
    if (!txDate) continue // skip rows without a valid date (blank separator etc.)

    const chargeDate = parseDateDMY(cols[COL_CHARGE_DATE] ?? '')
    const description = normaliseDescription(cols[COL_DESCRIPTION] ?? '')
    const category = (cols[COL_CATEGORY] ?? '').trim() || null
    const cardLastFour = (cols[COL_CARD_LAST_FOUR] ?? '').trim() || null
    const notes = (cols[COL_NOTES] ?? '').trim()

    const amountAgorot = parseAmount(cols[COL_AMOUNT] ?? '0')
    // Preserve sign from charge amount on original too
    const rawOriginal = parseFloat((cols[COL_ORIGINAL_AMOUNT] ?? '').trim())
    const originalSign = (cols[COL_AMOUNT] ?? '').trim().startsWith('-') ? -1 : 1
    const originalAmountAgorot = isNaN(rawOriginal)
      ? Math.abs(amountAgorot)
      : toShekels(rawOriginal) * originalSign

    const originalCurrency = normaliseCurrency(cols[COL_ORIGINAL_CURRENCY] ?? '₪')

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
