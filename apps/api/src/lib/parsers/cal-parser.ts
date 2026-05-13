/* eslint-disable security/detect-object-injection */
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

// The column header row is identified by this value in col 0 (may contain a
// literal newline inside the quoted field — we match on the first part only).
const COLUMN_HEADER_DATE_FIELD = 'תאריך'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Cal dates: D/M/YY  (e.g. 9/4/26, 24/4/26, 20/4/25)
function parseDateDMYY(raw: string): Date | null {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{2})$/.exec(raw.trim())
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

// Cal dates (newer export format): YYYY-MM-DD HH:MM:SS (e.g. 2026-05-07 00:00:00)
function parseDateISO(raw: string): Date | null {
  const match = /^(\d{4}-\d{2}-\d{2}) \d{2}:\d{2}:\d{2}$/.exec(raw.trim())
  if (!match) return null
  const date = new Date(match[1] as string)
  return isNaN(date.getTime()) ? null : date
}

function parseCalDate(raw: string): Date | null {
  return parseDateDMYY(raw) ?? parseDateISO(raw)
}

// Strip currency prefix (₪ / $) and thousands commas, return numeric string.
// e.g. "₪ 1,734.00" → "1734.00",  "$ 33.45" → "33.45"
function stripCurrencyPrefix(raw: string): { value: string; currency: string } {
  const s = raw.trim()
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

  // Remove thousands commas, trim whitespace
  const value = rest.replace(/,/g, '').trim()
  return { value, currency }
}

function parseCalAmount(raw: string): { agorot: number; currency: string } | null {
  if (!raw.trim()) return null
  const { value, currency } = stripCurrencyPrefix(raw)
  const n = parseFloat(value)
  if (isNaN(n)) return null
  return { agorot: toShekels(n), currency }
}

// RFC-4180 CSV splitter — same logic as max-parser, extracted here to avoid a
// cross-module dependency on a sibling parser file.
function splitCsvLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuote = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i] as string
    if (inQuote) {
      if (ch === '"') {
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

// ─── Card identifier extraction ───────────────────────────────────────────────

// CAL header line 1 pattern: "…המסתיים ב-XXXX"
const CARD_SUFFIX_RE = /המסתיים ב-(\d{4})/

export function extractCalCardIdentifiers(csv: string): string[] {
  const firstLine = csv.split('\n')[0] ?? ''
  const match = CARD_SUFFIX_RE.exec(firstLine)
  if (!match) throw new Error('CARD_NOT_FOUND')
  return [match[1] as string]
}

// ─── Charge date extraction ────────────────────────────────────────────────────

// CAL billing line pattern: "עסקאות לחיוב ב-DD/MM/YYYY: …"
const CHARGE_DATE_RE = /עסקאות לחיוב ב-(\d{2})\/(\d{2})\/(\d{4})/

function extractChargeDate(csv: string): Date | null {
  const match = CHARGE_DATE_RE.exec(csv)
  if (!match) return null
  const [, dd, mm, yyyy] = match
  const date = new Date(`${yyyy as string}-${mm as string}-${dd as string}`)
  return isNaN(date.getTime()) ? null : date
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parseCalCsv(csv: string): ParsedTransaction[] {
  if (!csv.trim()) throw new Error('CSV is empty')

  const chargeDate = extractChargeDate(csv)

  // Extract card last four from line 1 ("המסתיים ב-XXXX"); null if absent
  let cardLastFour: string | null = null
  try {
    const ids = extractCalCardIdentifiers(csv)
    cardLastFour = ids[0] ?? null
  } catch {
    // header missing — cardLastFour stays null
  }

  // Cal column headers span two physical lines because each header cell
  // contains a quoted embedded newline (e.g. `"תאריך\nעסקה"`).
  // After RFC-4180 splitting the joined logical lines, col 0 starts with
  // COLUMN_HEADER_DATE_FIELD. We scan logical lines (merging quoted newlines)
  // to find the header row.
  const rawLines = csv.split('\n')

  // Reconstruct logical lines (handle quoted fields that span physical lines)
  const logicalLines: string[] = []
  let buffer = ''
  let openQuotes = 0

  for (const raw of rawLines) {
    for (const ch of raw) {
      if (ch === '"') openQuotes ^= 1
    }
    buffer = buffer ? buffer + '\n' + raw : raw
    if (openQuotes === 0) {
      logicalLines.push(buffer)
      buffer = ''
    }
  }
  if (buffer) logicalLines.push(buffer)

  // Find the header logical line
  const headerIdx = logicalLines.findIndex(l => {
    const cols = splitCsvLine(l)
    return (cols[0] ?? '').startsWith(COLUMN_HEADER_DATE_FIELD)
  })
  if (headerIdx === -1) throw new Error('Cal CSV: column header row not found')

  const results: ParsedTransaction[] = []

  for (let i = headerIdx + 1; i < logicalLines.length; i++) {
    const line = logicalLines[i] ?? ''
    if (!line.trim()) continue

    const cols = splitCsvLine(line)

    const txDate = parseCalDate(cols[COL_TX_DATE] ?? '')
    if (!txDate) continue

    const description = (cols[COL_DESCRIPTION] ?? '').trim()
    const category = (cols[COL_CATEGORY] ?? '').trim() || null
    const notes = (cols[COL_NOTES] ?? '').trim()

    const txAmountParsed = parseCalAmount(cols[COL_TX_AMOUNT] ?? '')
    if (!txAmountParsed) continue

    const chargeAmountParsed = parseCalAmount(cols[COL_CHARGE_AMOUNT] ?? '')

    // amountAgorot = charge amount when present (installments); else tx amount
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
      notes: notes || null,
    })
  }

  return results
}
