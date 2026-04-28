import { prisma } from '../db/prisma.js'
import { parseMaxCsv } from '../lib/parsers/max-parser.js'
import { parseCalCsv } from '../lib/parsers/cal-parser.js'
import { computeDedupeHash } from '../lib/parsers/dedup-hash.js'
import type { ParsedTransaction } from '../lib/parsers/types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

export interface ImportCsvInput {
  csv: string
  filename: string
  accountId: string
  userId: string
}

export class ImportError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'ImportError'
  }
}

// ─── Format detection markers ─────────────────────────────────────────────────

const MAX_HEADER_MARKER = 'תאריך עסקה'
const CAL_HEADER_MARKER = 'שם בית עסק'

// ─── Service ──────────────────────────────────────────────────────────────────

export class ImportService {
  detectFormat(csv: string): 'max' | 'cal' | null {
    if (csv.includes(MAX_HEADER_MARKER) && csv.includes('שם בית העסק')) return 'max'
    if (csv.includes(CAL_HEADER_MARKER) && csv.includes('סכום\nחיוב')) return 'cal'
    return null
  }

  async importCsv(input: ImportCsvInput): Promise<ImportResult> {
    const { csv, filename, accountId, userId } = input

    // Verify the account belongs to this user — select only unencrypted columns
    const account = await prisma.account.findFirst({
      where: { id: accountId, userId },
      select: { id: true },
    })
    if (!account) throw new ImportError('ACCOUNT_NOT_FOUND')

    // Detect and parse
    const format = this.detectFormat(csv)
    if (!format) throw new ImportError('UNKNOWN_FORMAT')

    const rows: ParsedTransaction[] = format === 'max' ? parseMaxCsv(csv) : parseCalCsv(csv)

    // Create the import batch record
    const batch = await prisma.importBatch.create({
      data: { accountId, filename, rowCount: rows.length },
    })

    let inserted = 0
    let skipped = 0

    for (const row of rows) {
      const dedupeHash = computeDedupeHash({
        accountId,
        transactionDate: row.transactionDate,
        amountAgorot: row.amountAgorot,
        description: row.description,
      })

      // Global dedup — skip if this exact transaction already exists
      const existing = await prisma.transaction.findUnique({ where: { dedupeHash } })
      if (existing) {
        skipped++
        continue
      }

      // Build the create payload, omitting fields that are null/undefined
      // (exactOptionalPropertyTypes: true forbids assigning undefined to optional fields)
      await prisma.transaction.create({
        data: {
          accountId,
          importBatchId: batch.id,
          transactionDate: row.transactionDate,
          ...(row.chargeDate !== null && { chargeDate: row.chargeDate }),
          description: Buffer.from(row.description, 'utf-8'),
          amountAgorot: Buffer.from(row.amountAgorot.toString(), 'utf-8'),
          originalAmountAgorot: Buffer.from(row.originalAmountAgorot.toString(), 'utf-8'),
          ...(row.originalCurrency !== 'ILS' && { originalCurrency: row.originalCurrency }),
          ...(row.category !== null && { category: row.category }),
          ...(row.cardLastFour !== null && { cardLastFour: row.cardLastFour }),
          ...(row.installmentNum !== null && { installmentNum: row.installmentNum }),
          ...(row.installmentOf !== null && { installmentOf: row.installmentOf }),
          dedupeHash,
        },
      })

      await prisma.auditLog.create({
        data: {
          userId,
          action: 'INSERT',
          tableName: 'transactions',
          recordId: dedupeHash,
          newValues: {
            accountId,
            transactionDate: row.transactionDate,
            description: '[REDACTED]',
            amountAgorot: '[REDACTED]',
          },
        },
      })

      inserted++
    }

    return { inserted, skipped, errors: [] }
  }
}
