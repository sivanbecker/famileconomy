import { createHash } from 'node:crypto'
import { prisma } from '../db/prisma.js'
import { TransactionStatus } from '@prisma/client'
import { parseMaxCsv, extractMaxCardIdentifiers } from '../lib/parsers/max-parser.js'
import { parseCalCsv, extractCalCardIdentifiers } from '../lib/parsers/cal-parser.js'
import { parseMaxXlsx, extractMaxXlsxCardIdentifiers } from '../lib/parsers/max-xlsx-parser.js'
import { parseCalXlsx, extractCalXlsxCardIdentifiers } from '../lib/parsers/cal-xlsx-parser.js'
import { computeDedupeHash } from '../lib/parsers/dedup-hash.js'
import type { ParsedTransaction } from '../lib/parsers/types.js'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Provider = 'MAX' | 'CAL'

export interface ImportResult {
  inserted: number
  duplicates: number
  errors: string[]
}

export interface ImportCsvInput {
  csv: string
  filename: string
  provider: Provider
  userId: string
}

export interface ImportXlsxInput {
  fileBuffer: Buffer
  filename: string
  provider: Provider
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
    // CAL headers use quoted multi-line cells; the embedded newline may be \n or \r\n
    if (
      csv.includes(CAL_HEADER_MARKER) &&
      (csv.includes('סכום\nחיוב') || csv.includes('סכום\r\nחיוב'))
    )
      return 'cal'
    return null
  }

  // Idempotent: returns existing account id or creates a new CREDIT_CARD account.
  async findOrCreateAccount(
    userId: string,
    provider: Provider,
    cardLastFour: string
  ): Promise<string> {
    const name = Buffer.from(`${provider} ${cardLastFour}`, 'utf-8')

    const existing = await prisma.account.findFirst({
      where: { userId, name },
      select: { id: true },
    })
    if (existing) return existing.id

    const created = await prisma.account.create({
      data: { userId, name, type: 'CREDIT_CARD', currency: 'ILS' },
      select: { id: true },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'INSERT',
        tableName: 'accounts',
        recordId: created.id,
        newValues: { provider, cardLastFour },
      },
    })

    return created.id
  }

  async importCsv(input: ImportCsvInput): Promise<ImportResult> {
    const { csv, filename, provider, userId } = input

    // Detect format and validate it matches the stated provider
    const format = this.detectFormat(csv)
    const expectedFormat = provider === 'MAX' ? 'max' : 'cal'
    if (format !== expectedFormat) throw new ImportError('FORMAT_MISMATCH')

    // Batch-level dedup — reject re-upload of the exact same file content
    const fileHash = createHash('sha256').update(csv, 'utf8').digest('hex')
    const existingBatch = await prisma.importBatch.findFirst({ where: { fileHash } })
    if (existingBatch) throw new ImportError('FILE_ALREADY_IMPORTED')

    if (format === 'max') {
      return this.importMaxCsv({ csv, filename, userId, fileHash })
    } else {
      return this.importCalCsv({ csv, filename, userId, fileHash })
    }
  }

  async importXlsx(input: ImportXlsxInput): Promise<ImportResult> {
    const { fileBuffer, filename, provider, userId } = input

    // Batch-level dedup — reject re-upload of the exact same file content
    const fileHash = createHash('sha256').update(fileBuffer).digest('hex')
    const existingBatch = await prisma.importBatch.findFirst({ where: { fileHash } })
    if (existingBatch) throw new ImportError('FILE_ALREADY_IMPORTED')

    if (provider === 'MAX') {
      return this.importMaxXlsx({ fileBuffer, filename, userId, fileHash })
    } else {
      return this.importCalXlsx({ fileBuffer, filename, userId, fileHash })
    }
  }

  // ─── MAX import ─────────────────────────────────────────────────────────────

  private async importMaxCsv(opts: {
    csv: string
    filename: string
    userId: string
    fileHash: string
  }): Promise<ImportResult> {
    const { csv, filename, userId, fileHash } = opts
    const cardIdentifiers = extractMaxCardIdentifiers(csv)
    const allRows = parseMaxCsv(csv)

    let inserted = 0
    let duplicates = 0

    for (const cardLastFour of cardIdentifiers) {
      const accountId = await this.findOrCreateAccount(userId, 'MAX', cardLastFour)
      const rows = allRows.filter(r => r.cardLastFour === cardLastFour)

      const batch = await prisma.importBatch.create({
        data: { accountId, filename, fileHash, rowCount: rows.length },
      })

      const result = await this.insertRows(rows, accountId, batch.id, userId)
      inserted += result.inserted
      duplicates += result.duplicates
    }

    return { inserted, duplicates, errors: [] }
  }

  // ─── CAL import ─────────────────────────────────────────────────────────────

  private async importCalCsv(opts: {
    csv: string
    filename: string
    userId: string
    fileHash: string
  }): Promise<ImportResult> {
    const { csv, filename, userId, fileHash } = opts
    const [cardLastFour] = extractCalCardIdentifiers(csv)
    if (!cardLastFour) throw new ImportError('CARD_NOT_FOUND')

    const accountId = await this.findOrCreateAccount(userId, 'CAL', cardLastFour)
    const rows = parseCalCsv(csv)

    const batch = await prisma.importBatch.create({
      data: { accountId, filename, fileHash, rowCount: rows.length },
    })

    const result = await this.insertRows(rows, accountId, batch.id, userId)
    return { inserted: result.inserted, duplicates: result.duplicates, errors: [] }
  }

  // ─── MAX XLSX import ────────────────────────────────────────────────────────

  private async importMaxXlsx(opts: {
    fileBuffer: Buffer
    filename: string
    userId: string
    fileHash: string
  }): Promise<ImportResult> {
    const { fileBuffer, filename, userId, fileHash } = opts
    const cardIdentifiers = await extractMaxXlsxCardIdentifiers(fileBuffer)
    const allRows = await parseMaxXlsx(fileBuffer)

    let inserted = 0
    let duplicates = 0

    for (const cardLastFour of cardIdentifiers) {
      const accountId = await this.findOrCreateAccount(userId, 'MAX', cardLastFour)
      const rows = allRows.filter(r => r.cardLastFour === cardLastFour)

      const batch = await prisma.importBatch.create({
        data: { accountId, filename, fileHash, rowCount: rows.length },
      })

      const result = await this.insertRows(rows, accountId, batch.id, userId)
      inserted += result.inserted
      duplicates += result.duplicates
    }

    return { inserted, duplicates, errors: [] }
  }

  // ─── CAL XLSX import ────────────────────────────────────────────────────────

  private async importCalXlsx(opts: {
    fileBuffer: Buffer
    filename: string
    userId: string
    fileHash: string
  }): Promise<ImportResult> {
    const { fileBuffer, filename, userId, fileHash } = opts
    const [cardLastFour] = await extractCalXlsxCardIdentifiers(fileBuffer)
    if (!cardLastFour) throw new ImportError('CARD_NOT_FOUND')

    const accountId = await this.findOrCreateAccount(userId, 'CAL', cardLastFour)
    const rows = await parseCalXlsx(fileBuffer)

    const batch = await prisma.importBatch.create({
      data: { accountId, filename, fileHash, rowCount: rows.length },
    })

    const result = await this.insertRows(rows, accountId, batch.id, userId)
    return { inserted: result.inserted, duplicates: result.duplicates, errors: [] }
  }

  // ─── Row insertion ──────────────────────────────────────────────────────────

  private async insertRows(
    rows: ParsedTransaction[],
    accountId: string,
    importBatchId: string,
    userId: string
  ): Promise<{ inserted: number; duplicates: number }> {
    let inserted = 0
    let duplicates = 0

    for (const row of rows) {
      const dedupeHash = computeDedupeHash({
        accountId,
        transactionDate: row.transactionDate,
        amountAgorot: row.amountAgorot,
        description: row.description,
      })

      const existing = await prisma.transaction.findFirst({
        where: { dedupeHash, importBatchId },
      })

      const baseData = {
        accountId,
        importBatchId,
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
      }

      if (existing) {
        await prisma.transaction.create({
          data: { ...baseData, status: TransactionStatus.DUPLICATE, duplicateOf: existing.id },
        })
        duplicates++
      } else if (row.isPending) {
        await prisma.transaction.create({
          data: { ...baseData, status: TransactionStatus.PENDING },
        })
        inserted++
      } else {
        // Check if this cleared row settles an existing PENDING transaction
        // (same account + description + exact amount, previously in limbo)
        const pendingMatch = await prisma.transaction.findFirst({
          where: {
            accountId,
            description: Buffer.from(row.description, 'utf-8'),
            amountAgorot: Buffer.from(row.amountAgorot.toString(), 'utf-8'),
            status: TransactionStatus.PENDING,
          },
          select: { id: true },
        })

        if (pendingMatch) {
          await prisma.transaction.update({
            where: { id: pendingMatch.id },
            data: {
              status: TransactionStatus.CLEARED,
              ...(row.chargeDate !== null && { chargeDate: row.chargeDate }),
            },
          })
          await prisma.transaction.create({
            data: {
              ...baseData,
              status: TransactionStatus.DUPLICATE,
              duplicateOf: pendingMatch.id,
            },
          })
          duplicates++
        } else {
          await prisma.transaction.create({ data: baseData })

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
      }
    }

    return { inserted, duplicates }
  }
}
