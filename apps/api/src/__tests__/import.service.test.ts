import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportService, ImportError } from '../services/import.service.js'
import { prisma } from '../db/prisma.js'

// prisma is mocked globally in src/test/setup.ts

const ACCOUNT_ID = 'acc-uuid-1'
const USER_ID = 'user-uuid-1'

const MAX_SINGLE_ROW =
  `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
  `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
  `05/2026,,,,,,,,,,,,,,,\n` +
  `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
  `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
  `,,,,,,,,,,,,,,,\n` +
  `סך הכל,,,,,,,,,,,,,,,\n` +
  `17₪,,,,,,,,,,,,,,,`

const CAL_SINGLE_ROW =
  `פירוט עסקאות,,,,,,\n` +
  `,,,,,,\n` +
  `"עסקאות לחיוב ב-10/05/2026: 264.62 ₪",,,,,,\n` +
  `עסקאות בתהליך קליטה 0 ₪,,,,,,\n` +
  `"תאריך\nעסקה",שם בית עסק,"סכום\nעסקה","סכום\nחיוב","סוג\nעסקה",ענף,הערות\n` +
  `24/4/26,א.י קמעונאות מזון,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,\n` +
  `,,,,,,\n` +
  `את המידע המלא,,,,,,`

describe('ImportService', () => {
  let service: ImportService

  beforeEach(() => {
    vi.resetAllMocks()
    service = new ImportService()
  })

  // ─── Format detection ──────────────────────────────────────────────────────

  describe('detectFormat', () => {
    it('detects Max format by column header marker', () => {
      expect(service.detectFormat(MAX_SINGLE_ROW)).toBe('max')
    })

    it('detects Cal format by column header marker', () => {
      expect(service.detectFormat(CAL_SINGLE_ROW)).toBe('cal')
    })

    it('returns null for unrecognised CSV', () => {
      expect(service.detectFormat('date,amount\n2026-01-01,100')).toBeNull()
    })
  })

  // ─── Happy path ────────────────────────────────────────────────────────────

  describe('importCsv', () => {
    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: ACCOUNT_ID,
        userId: USER_ID,
        name: 'Test Account',
        type: 'CREDIT_CARD',
        currency: 'ILS',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.importBatch.create).mockResolvedValue({
        id: 'batch-1',
        accountId: ACCOUNT_ID,
        filename: 'test.csv',
        rowCount: 1,
        importedAt: new Date(),
      })
      vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('returns inserted=1, duplicates=0 for a single new Max transaction', async () => {
      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })
      expect(result).toEqual({ inserted: 1, duplicates: 0, errors: [] })
    })

    it('returns inserted=1, duplicates=0 for a single new Cal transaction', async () => {
      const result = await service.importCsv({
        csv: CAL_SINGLE_ROW,
        filename: 'cal.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })
      expect(result).toEqual({ inserted: 1, duplicates: 0, errors: [] })
    })

    it('creates an ImportBatch record', async () => {
      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })
      expect(prisma.importBatch.create).toHaveBeenCalledOnce()
      expect(prisma.importBatch.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ accountId: ACCOUNT_ID, filename: 'max.csv' }),
        })
      )
    })

    it('writes an audit log entry for each inserted transaction', async () => {
      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })
      expect(prisma.auditLog.create).toHaveBeenCalledOnce()
    })
  })

  // ─── Deduplication ─────────────────────────────────────────────────────────

  describe('deduplication', () => {
    const EXISTING_TX_ID = 'existing-tx-uuid'

    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: ACCOUNT_ID,
        userId: USER_ID,
        name: 'Test',
        type: 'CREDIT_CARD',
        currency: 'ILS',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.importBatch.create).mockResolvedValue({
        id: 'batch-1',
        accountId: ACCOUNT_ID,
        filename: 'test.csv',
        rowCount: 1,
        importedAt: new Date(),
      })
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('inserts a DUPLICATE transaction (not skips) when dedupe_hash already exists', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: EXISTING_TX_ID } as never)

      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })

      expect(result).toEqual({ inserted: 0, duplicates: 1, errors: [] })
      expect(prisma.transaction.create).toHaveBeenCalledOnce()
    })

    it('sets status=DUPLICATE and duplicate_of=<original id> on the inserted row', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: EXISTING_TX_ID } as never)

      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })

      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'DUPLICATE',
            duplicateOf: EXISTING_TX_ID,
          }),
        })
      )
    })

    it('does NOT write an audit log entry for duplicate transactions', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: EXISTING_TX_ID } as never)

      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('returns inserted=1 duplicates=0 when no existing transaction matches', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        accountId: ACCOUNT_ID,
        userId: USER_ID,
      })

      expect(result).toEqual({ inserted: 1, duplicates: 0, errors: [] })
    })
  })

  // ─── Error cases ───────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('throws ImportError ACCOUNT_NOT_FOUND when account does not belong to user', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)

      await expect(
        service.importCsv({
          csv: MAX_SINGLE_ROW,
          filename: 'max.csv',
          accountId: ACCOUNT_ID,
          userId: USER_ID,
        })
      ).rejects.toThrow(ImportError)

      await expect(
        service.importCsv({
          csv: MAX_SINGLE_ROW,
          filename: 'max.csv',
          accountId: ACCOUNT_ID,
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'ACCOUNT_NOT_FOUND' })
    })

    it('throws ImportError UNKNOWN_FORMAT when CSV format is not recognised', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: ACCOUNT_ID,
        userId: USER_ID,
        name: 'Test',
        type: 'CREDIT_CARD',
        currency: 'ILS',
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        service.importCsv({
          csv: 'date,amount\n2026-01-01,100',
          filename: 'unknown.csv',
          accountId: ACCOUNT_ID,
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'UNKNOWN_FORMAT' })
    })

    it('throws ImportError FILE_ALREADY_IMPORTED when the same file was already imported', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: ACCOUNT_ID,
        userId: USER_ID,
        name: 'Test',
        type: 'CREDIT_CARD',
        currency: 'ILS',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      // Simulate existing batch with same file hash
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue({
        id: 'batch-old',
        accountId: ACCOUNT_ID,
        filename: 'max.csv',
        fileHash: 'any-hash',
        rowCount: 1,
        importedAt: new Date(),
      } as never)

      await expect(
        service.importCsv({
          csv: MAX_SINGLE_ROW,
          filename: 'max.csv',
          accountId: ACCOUNT_ID,
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'FILE_ALREADY_IMPORTED' })
    })

    it('does not insert any rows when FILE_ALREADY_IMPORTED is thrown', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue({
        id: ACCOUNT_ID,
        userId: USER_ID,
        name: 'Test',
        type: 'CREDIT_CARD',
        currency: 'ILS',
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue({ id: 'batch-old' } as never)

      await expect(
        service.importCsv({
          csv: MAX_SINGLE_ROW,
          filename: 'max.csv',
          accountId: ACCOUNT_ID,
          userId: USER_ID,
        })
      ).rejects.toThrow()

      expect(prisma.importBatch.create).not.toHaveBeenCalled()
      expect(prisma.transaction.create).not.toHaveBeenCalled()
    })
  })
})
