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

export interface DuplicateRecord {
  date: string
  amountAgorot: number
  description: string
  originalImportedFrom: string | null
}

export interface ImportResult {
  inserted: number
  duplicates: number
  withinFileDuplicates: number
  errors: string[]
  skippedRows: DuplicateRecord[]
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
    let withinFileDuplicates = 0
    const skippedRows: DuplicateRecord[] = []

    for (const cardLastFour of cardIdentifiers) {
      const accountId = await this.findOrCreateAccount(userId, 'MAX', cardLastFour)
      const rows = allRows.filter(r => r.cardLastFour === cardLastFour)

      const batch = await prisma.importBatch.create({
        data: { accountId, filename, fileHash, rowCount: rows.length },
      })

      const result = await this.insertRows(rows, accountId, batch.id, userId)
      inserted += result.inserted
      duplicates += result.duplicates
      withinFileDuplicates += result.withinFileDuplicates
      skippedRows.push(...result.skippedRows)
    }

    return { inserted, duplicates, withinFileDuplicates, errors: [], skippedRows }
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
    return {
      inserted: result.inserted,
      duplicates: result.duplicates,
      withinFileDuplicates: result.withinFileDuplicates,
      errors: [],
      skippedRows: result.skippedRows,
    }
  }

  // ─── MAX XLSX import ────────────────────────────────────────────────────────

  private async importMaxXlsx(opts: {
    fileBuffer: Buffer
    filename: string
    userId: string
    fileHash: string
  }): Promise<ImportResult> {
    const { fileBuffer, filename, userId, fileHash } = opts
    try {
      const cardIdentifiers = await extractMaxXlsxCardIdentifiers(fileBuffer)
      const allRows = await parseMaxXlsx(fileBuffer)

      let inserted = 0
      let duplicates = 0
      let withinFileDuplicates = 0
      const skippedRows: DuplicateRecord[] = []

      for (const cardLastFour of cardIdentifiers) {
        const accountId = await this.findOrCreateAccount(userId, 'MAX', cardLastFour)
        const rows = allRows.filter(r => r.cardLastFour === cardLastFour)

        const batch = await prisma.importBatch.create({
          data: { accountId, filename, fileHash, rowCount: rows.length },
        })

        const result = await this.insertRows(rows, accountId, batch.id, userId)
        inserted += result.inserted
        duplicates += result.duplicates
        withinFileDuplicates += result.withinFileDuplicates
        skippedRows.push(...result.skippedRows)
      }

      return { inserted, duplicates, withinFileDuplicates, errors: [], skippedRows }
    } catch (err) {
      if (err instanceof ImportError) throw err
      if (err instanceof Error) {
        if (err.message.includes('failed to load file')) throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('no worksheet found')) throw new ImportError('FORMAT_MISMATCH')
      }
      throw err
    }
  }

  // ─── CAL XLSX import ────────────────────────────────────────────────────────

  private async importCalXlsx(opts: {
    fileBuffer: Buffer
    filename: string
    userId: string
    fileHash: string
  }): Promise<ImportResult> {
    const { fileBuffer, filename, userId, fileHash } = opts
    try {
      const [cardLastFour] = await extractCalXlsxCardIdentifiers(fileBuffer)
      if (!cardLastFour) throw new ImportError('CARD_NOT_FOUND')

      const accountId = await this.findOrCreateAccount(userId, 'CAL', cardLastFour)
      const rows = await parseCalXlsx(fileBuffer)

      const batch = await prisma.importBatch.create({
        data: { accountId, filename, fileHash, rowCount: rows.length },
      })

      const result = await this.insertRows(rows, accountId, batch.id, userId)
      return {
        inserted: result.inserted,
        duplicates: result.duplicates,
        withinFileDuplicates: result.withinFileDuplicates,
        errors: [],
        skippedRows: result.skippedRows,
      }
    } catch (err) {
      if (err instanceof ImportError) throw err
      if (err instanceof Error) {
        if (err.message.includes('failed to load file')) throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('card identifier not found'))
          throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('charge date not found')) throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('header row not found')) throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('Card ID check FAILED')) throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('Charge date check FAILED'))
          throw new ImportError('FORMAT_MISMATCH')
        if (err.message.includes('Header row check FAILED'))
          throw new ImportError('FORMAT_MISMATCH')
      }
      throw err
    }
  }

  // ─── Row insertion ──────────────────────────────────────────────────────────

  private withinFileGroupKey(row: ParsedTransaction): string {
    return `${row.transactionDate.toISOString()}|${row.amountAgorot}|${row.description}`
  }

  private async insertRows(
    rows: ParsedTransaction[],
    accountId: string,
    importBatchId: string,
    userId: string
  ): Promise<{
    inserted: number
    duplicates: number
    withinFileDuplicates: number
    skippedRows: DuplicateRecord[]
  }> {
    let inserted = 0
    let duplicates = 0
    let withinFileDuplicates = 0
    const skippedRows: DuplicateRecord[] = []

    // Build within-file group map: key → index of the first (canonical) occurrence.
    const firstOccurrenceIndex = new Map<string, number>()
    for (let i = 0; i < rows.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const row = rows[i]
      if (row === undefined) continue
      const key = this.withinFileGroupKey(row)
      if (!firstOccurrenceIndex.has(key)) firstOccurrenceIndex.set(key, i)
    }

    // Track the inserted ID of the canonical row for each within-file group so
    // subsequent rows can point their duplicate_of FK at it.
    // A null value means the canonical was itself a cross-file duplicate — in that
    // case the whole group falls through to cross-file duplicate handling.
    const canonicalIdByKey = new Map<string, string | null>()

    for (let i = 0; i < rows.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const row = rows[i]
      if (row === undefined) continue

      const key = this.withinFileGroupKey(row)
      const isWithinFileDuplicate = firstOccurrenceIndex.get(key) !== i

      const dedupeHash = computeDedupeHash({
        accountId,
        transactionDate: row.transactionDate,
        amountAgorot: row.amountAgorot,
        description: row.description,
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
        ...(row.notes !== null && { notes: row.notes }),
        dedupeHash,
      }

      if (isWithinFileDuplicate) {
        const canonicalId = canonicalIdByKey.get(key)
        if (canonicalId === null) {
          // Canonical was a cross-file duplicate — treat this row the same way.
          // Re-run the DB check to find the original for the duplicate_of FK.
          const existing = await prisma.transaction.findFirst({
            where: {
              dedupeHash,
              status: {
                notIn: [TransactionStatus.DUPLICATE, TransactionStatus.WITHIN_FILE_DUPLICATE],
              },
            },
            select: { id: true, importBatch: { select: { filename: true } } },
          })
          await prisma.transaction.create({
            data: {
              ...baseData,
              status: TransactionStatus.DUPLICATE,
              ...(existing !== null && { duplicateOf: existing.id }),
            },
          })
          skippedRows.push({
            date: row.transactionDate.toISOString().slice(0, 10),
            amountAgorot: row.amountAgorot,
            description: row.description,
            originalImportedFrom: existing?.importBatch?.filename ?? null,
          })
          duplicates++
        } else {
          await prisma.transaction.create({
            data: {
              ...baseData,
              status: TransactionStatus.WITHIN_FILE_DUPLICATE,
              ...(canonicalId !== undefined && { duplicateOf: canonicalId }),
            },
          })
          withinFileDuplicates++
          inserted++
        }
        continue
      }

      const existing = await prisma.transaction.findFirst({
        where: {
          dedupeHash,
          status: {
            notIn: [TransactionStatus.DUPLICATE, TransactionStatus.WITHIN_FILE_DUPLICATE],
          },
        },
        select: {
          id: true,
          importBatch: { select: { filename: true } },
        },
      })

      if (existing) {
        canonicalIdByKey.set(key, null)
        await prisma.transaction.create({
          data: { ...baseData, status: TransactionStatus.DUPLICATE, duplicateOf: existing.id },
        })
        skippedRows.push({
          date: row.transactionDate.toISOString().slice(0, 10),
          amountAgorot: row.amountAgorot,
          description: row.description,
          originalImportedFrom: existing.importBatch?.filename ?? null,
        })
        duplicates++
      } else if (row.isPending) {
        const created = await prisma.transaction.create({
          data: { ...baseData, status: TransactionStatus.PENDING },
          select: { id: true },
        })
        canonicalIdByKey.set(key, created.id)
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
          select: {
            id: true,
            importBatch: { select: { filename: true } },
          },
        })

        if (pendingMatch) {
          canonicalIdByKey.set(key, null)
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
          skippedRows.push({
            date: row.transactionDate.toISOString().slice(0, 10),
            amountAgorot: row.amountAgorot,
            description: row.description,
            originalImportedFrom: pendingMatch.importBatch?.filename ?? null,
          })
          duplicates++
        } else {
          const created = await prisma.transaction.create({
            data: baseData,
            select: { id: true },
          })
          canonicalIdByKey.set(key, created.id)

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

    return { inserted, duplicates, withinFileDuplicates, skippedRows }
  }
}
