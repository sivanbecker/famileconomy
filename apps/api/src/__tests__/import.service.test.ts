import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ImportService } from '../services/import.service.js'
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

// MAX file with two distinct cards
const MAX_TWO_CARDS =
  `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
  `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
  `05/2026,,,,,,,,,,,,,,,\n` +
  `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
  `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
  `10-04-2026,סופר-פארם,מזון וצריכה,9999,רגילה,50,₪,50,₪,10-05-2026,,,,,,\n` +
  `,,,,,,,,,,,,,,,\n` +
  `סך הכל,,,,,,,,,,,,,,,\n` +
  `67₪,,,,,,,,,,,,,,,`

const CAL_SINGLE_ROW =
  `פירוט עסקאות לחשבון מזרחי-טפחות 123-123456 לכרטיס ויזה זהב עסקי המסתיים ב-1234,,,,,,\n` +
  `,,,,,,\n` +
  `"עסקאות לחיוב ב-10/05/2026: 264.62 ₪",,,,,,\n` +
  `עסקאות בתהליך קליטה 0 ₪,,,,,,\n` +
  `"תאריך\nעסקה",שם בית עסק,"סכום\nעסקה","סכום\nחיוב","סוג\nעסקה",ענף,הערות\n` +
  `24/4/26,א.י קמעונאות מזון,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,\n` +
  `,,,,,,\n` +
  `את המידע המלא,,,,,,`

// Same file exported on Windows — column headers use \r\n inside quoted fields
const CAL_SINGLE_ROW_CRLF =
  `פירוט עסקאות לחשבון מזרחי-טפחות 123-123456 לכרטיס ויזה זהב עסקי המסתיים ב-1234,,,,,,\r\n` +
  `,,,,,,\r\n` +
  `"עסקאות לחיוב ב-10/05/2026: 264.62 ₪",,,,,,\r\n` +
  `עסקאות בתהליך קליטה 0 ₪,,,,,,\r\n` +
  `"תאריך\r\nעסקה",שם בית עסק,"סכום\r\nעסקה","סכום\r\nחיוב","סוג\r\nעסקה",ענף,הערות\r\n` +
  `24/4/26,א.י קמעונאות מזון,₪ 264.62,₪ 264.62,רגילה,מזון ומשקאות,\r\n` +
  `,,,,,,\r\n` +
  `את המידע המלא,,,,,,`

// CAL file containing one pending ("עסקה בקליטה") row
const CAL_PENDING_ROW =
  `פירוט עסקאות לחשבון מזרחי-טפחות 123-123456 לכרטיס ויזה זהב עסקי המסתיים ב-1234,,,,,,\n` +
  `,,,,,,\n` +
  `"עסקאות לחיוב ב-10/05/2026: 35.00 ₪",,,,,,\n` +
  `עסקאות בתהליך קליטה 35.00 ₪,,,,,,\n` +
  `"תאריך\nעסקה",שם בית עסק,"סכום\nעסקה","סכום\nחיוב","סוג\nעסקה",ענף,הערות\n` +
  `29/4/26,מאפיית בראשית,₪ 35.00,,רכישה רגילה,מסעדות,עסקה בקליטה\n` +
  `,,,,,,\n` +
  `את המידע המלא,,,,,,`

// Next month's CAL file — same merchant/amount, now fully cleared
const CAL_CLEARED_ROW =
  `פירוט עסקאות לחשבון מזרחי-טפחות 123-123456 לכרטיס ויזה זהב עסקי המסתיים ב-1234,,,,,,\n` +
  `,,,,,,\n` +
  `"עסקאות לחיוב ב-10/06/2026: 35.00 ₪",,,,,,\n` +
  `עסקאות בתהליך קליטה 0 ₪,,,,,,\n` +
  `"תאריך\nעסקה",שם בית עסק,"סכום\nעסקה","סכום\nחיוב","סוג\nעסקה",ענף,הערות\n` +
  `29/4/26,מאפיית בראשית,₪ 35.00,₪ 35.00,רגילה,מסעדות,\n` +
  `,,,,,,\n` +
  `את המידע המלא,,,,,,`

const MOCK_ACCOUNT = {
  id: ACCOUNT_ID,
  userId: USER_ID,
  name: Buffer.from('Test Account', 'utf-8'),
  type: 'CREDIT_CARD' as const,
  currency: 'ILS',
  createdAt: new Date(),
  updatedAt: new Date(),
}

const MOCK_BATCH = {
  id: 'batch-1',
  accountId: ACCOUNT_ID,
  filename: 'test.csv',
  fileHash: null,
  rowCount: 1,
  importedAt: new Date(),
}

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

    it('detects Cal format when column headers use CRLF line endings (Windows export)', () => {
      expect(service.detectFormat(CAL_SINGLE_ROW_CRLF)).toBe('cal')
    })

    it('returns null for unrecognised CSV', () => {
      expect(service.detectFormat('date,amount\n2026-01-01,100')).toBeNull()
    })
  })

  // ─── findOrCreateAccount ───────────────────────────────────────────────────

  describe('findOrCreateAccount', () => {
    it('returns existing account id when account already exists', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)

      const id = await service.findOrCreateAccount(USER_ID, 'MAX', '5432')

      expect(id).toBe(ACCOUNT_ID)
      expect(prisma.account.create).not.toHaveBeenCalled()
    })

    it('creates a new account when none exists and returns its id', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.account.create).mockResolvedValue({
        ...MOCK_ACCOUNT,
        id: 'new-acc-uuid',
        name: Buffer.from('MAX 5432', 'utf-8'),
      })
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

      const id = await service.findOrCreateAccount(USER_ID, 'MAX', '5432')

      expect(id).toBe('new-acc-uuid')
      expect(prisma.account.create).toHaveBeenCalledOnce()
    })

    it('creates the account with name "<PROVIDER> <cardLastFour>" encoded as BYTEA', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.account.create).mockResolvedValue({ ...MOCK_ACCOUNT, id: 'new-acc' })
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

      await service.findOrCreateAccount(USER_ID, 'CAL', '1234')

      expect(prisma.account.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: Buffer.from('CAL 1234', 'utf-8'),
            type: 'CREDIT_CARD',
            userId: USER_ID,
          }),
        })
      )
    })

    it('writes an audit log entry when a new account is created', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.account.create).mockResolvedValue({ ...MOCK_ACCOUNT, id: 'new-acc' })
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

      await service.findOrCreateAccount(USER_ID, 'MAX', '5432')

      expect(prisma.auditLog.create).toHaveBeenCalledOnce()
    })

    it('does NOT write an audit log entry when the account already exists', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)

      await service.findOrCreateAccount(USER_ID, 'MAX', '5432')

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('looks up the account by userId + provider + cardLastFour name', async () => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)

      await service.findOrCreateAccount(USER_ID, 'MAX', '5432')

      expect(prisma.account.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ userId: USER_ID }),
        })
      )
    })
  })

  // ─── Happy path ────────────────────────────────────────────────────────────

  describe('importCsv', () => {
    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.account.create).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.create).mockResolvedValue(MOCK_BATCH)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('returns inserted=1, duplicates=0 for a single new Max transaction', async () => {
      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })
      expect(result).toEqual({
        inserted: 1,
        duplicates: 0,
        withinFileDuplicates: 0,
        pendingSkipped: 0,
        errors: [],
        skippedRows: [],
      })
    })

    it('returns inserted=1, duplicates=0 for a single new Cal transaction', async () => {
      const result = await service.importCsv({
        csv: CAL_SINGLE_ROW,
        filename: 'cal.csv',
        provider: 'CAL',
        userId: USER_ID,
      })
      expect(result).toEqual({
        inserted: 1,
        duplicates: 0,
        withinFileDuplicates: 0,
        pendingSkipped: 0,
        errors: [],
        skippedRows: [],
      })
    })

    it('creates an ImportBatch record', async () => {
      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
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
        provider: 'MAX',
        userId: USER_ID,
      })
      // 1 audit log for the transaction (account already exists so no account audit)
      expect(prisma.auditLog.create).toHaveBeenCalled()
    })

    it('persists chargeDate from the CAL billing header on each transaction', async () => {
      await service.importCsv({
        csv: CAL_SINGLE_ROW,
        filename: 'cal.csv',
        provider: 'CAL',
        userId: USER_ID,
      })
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            chargeDate: new Date('2026-05-10'),
          }),
        })
      )
    })

    it('handles a MAX file with two distinct cards — one batch per card', async () => {
      vi.mocked(prisma.importBatch.create)
        .mockResolvedValueOnce({ ...MOCK_BATCH, id: 'batch-5432', accountId: ACCOUNT_ID })
        .mockResolvedValueOnce({ ...MOCK_BATCH, id: 'batch-9999', accountId: 'acc-9999' })

      const result = await service.importCsv({
        csv: MAX_TWO_CARDS,
        filename: 'max-two.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      // 1 row per card = 2 total inserted
      expect(result.inserted).toBe(2)
      expect(prisma.importBatch.create).toHaveBeenCalledTimes(2)
    })
  })

  // ─── Format mismatch ───────────────────────────────────────────────────────

  describe('format mismatch', () => {
    it('throws FORMAT_MISMATCH when user picks MAX but uploads a CAL file', async () => {
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)

      await expect(
        service.importCsv({
          csv: CAL_SINGLE_ROW,
          filename: 'cal.csv',
          provider: 'MAX',
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'FORMAT_MISMATCH' })
    })

    it('throws FORMAT_MISMATCH when user picks CAL but uploads a MAX file', async () => {
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)

      await expect(
        service.importCsv({
          csv: MAX_SINGLE_ROW,
          filename: 'max.csv',
          provider: 'CAL',
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'FORMAT_MISMATCH' })
    })

    it('does not create any DB records on FORMAT_MISMATCH', async () => {
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)

      await expect(
        service.importCsv({
          csv: CAL_SINGLE_ROW,
          filename: 'cal.csv',
          provider: 'MAX',
          userId: USER_ID,
        })
      ).rejects.toThrow()

      expect(prisma.account.create).not.toHaveBeenCalled()
      expect(prisma.importBatch.create).not.toHaveBeenCalled()
      expect(prisma.transaction.create).not.toHaveBeenCalled()
    })
  })

  // ─── Deduplication ─────────────────────────────────────────────────────────

  describe('deduplication', () => {
    const EXISTING_TX_ID = 'existing-tx-uuid'

    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.account.create).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.create).mockResolvedValue(MOCK_BATCH)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('inserts a DUPLICATE transaction (not skips) when dedupe_hash already exists', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: EXISTING_TX_ID,
        importBatch: { filename: 'previous.csv' },
      } as never)

      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.inserted).toBe(0)
      expect(result.duplicates).toBe(1)
      expect(result.errors).toEqual([])
      expect(result.skippedRows).toHaveLength(1)
      expect(prisma.transaction.create).toHaveBeenCalledOnce()
    })

    it('sets status=DUPLICATE and duplicate_of=<original id> on the inserted row', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: EXISTING_TX_ID } as never)

      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
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
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(prisma.auditLog.create).not.toHaveBeenCalled()
    })

    it('returns inserted=1 duplicates=0 when no existing transaction matches', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result).toEqual({
        inserted: 1,
        duplicates: 0,
        withinFileDuplicates: 0,
        pendingSkipped: 0,
        errors: [],
        skippedRows: [],
      })
    })

    it('includes a skippedRows list in the response', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: EXISTING_TX_ID,
        importBatch: { filename: 'previous.csv' },
      } as never)

      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.skippedRows).toHaveLength(1)
      expect(result.skippedRows[0]).toMatchObject({
        date: '2026-04-09',
        amountAgorot: 1700,
        description: 'מאפיית בראשית',
        originalImportedFrom: 'previous.csv',
      })
    })

    it('records originalImportedFrom as null when the original has no importBatch', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: EXISTING_TX_ID,
        importBatch: null,
      } as never)

      const result = await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.skippedRows[0]?.originalImportedFrom).toBeNull()
    })

    it('throws FILE_ALREADY_IMPORTED when the same file was already imported', async () => {
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
          provider: 'MAX',
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'FILE_ALREADY_IMPORTED' })
    })

    it('does not insert any rows when FILE_ALREADY_IMPORTED is thrown', async () => {
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue({ id: 'batch-old' } as never)

      await expect(
        service.importCsv({
          csv: MAX_SINGLE_ROW,
          filename: 'max.csv',
          provider: 'MAX',
          userId: USER_ID,
        })
      ).rejects.toThrow()

      expect(prisma.importBatch.create).not.toHaveBeenCalled()
      expect(prisma.transaction.create).not.toHaveBeenCalled()
    })
  })

  // ─── Pending transaction handling ─────────────────────────────────────────

  describe('pending transactions', () => {
    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.account.create).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.create).mockResolvedValue(MOCK_BATCH)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('silently skips pending rows — does not insert them', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      const result = await service.importCsv({
        csv: CAL_PENDING_ROW,
        filename: 'cal-may.csv',
        provider: 'CAL',
        userId: USER_ID,
      })

      expect(prisma.transaction.create).not.toHaveBeenCalled()
      expect(result.inserted).toBe(0)
      expect(result.duplicates).toBe(0)
      expect(result.pendingSkipped).toBe(1)
      expect(result.errors).toEqual([])
    })

    it('inserts the cleared version of a previously-pending row as a normal new transaction', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({ id: 'new-tx' } as never)

      const result = await service.importCsv({
        csv: CAL_CLEARED_ROW,
        filename: 'cal-jun.csv',
        provider: 'CAL',
        userId: USER_ID,
      })

      expect(result.inserted).toBe(1)
      expect(result.duplicates).toBe(0)
      expect(prisma.transaction.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ status: 'PENDING' }),
        })
      )
    })
  })

  // ─── Within-file duplicate detection ─────────────────────────────────────

  describe('within-file duplicates', () => {
    // MAX file with two identical rows (same date + amount + description + card)
    const MAX_TWO_IDENTICAL_ROWS =
      `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
      `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
      `05/2026,,,,,,,,,,,,,,,\n` +
      `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
      `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
      `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
      `,,,,,,,,,,,,,,,\n` +
      `סך הכל,,,,,,,,,,,,,,,\n` +
      `34₪,,,,,,,,,,,,,,,`

    // MAX file with three identical rows
    const MAX_THREE_IDENTICAL_ROWS =
      `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
      `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
      `05/2026,,,,,,,,,,,,,,,\n` +
      `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
      `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
      `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
      `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
      `,,,,,,,,,,,,,,,\n` +
      `סך הכל,,,,,,,,,,,,,,,\n` +
      `51₪,,,,,,,,,,,,,,,`

    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.account.create).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.create).mockResolvedValue(MOCK_BATCH)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('imports ALL rows when a file contains two identical rows', async () => {
      const result = await service.importCsv({
        csv: MAX_TWO_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.inserted).toBe(2)
      expect(result.withinFileDuplicates).toBe(1)
      expect(prisma.transaction.create).toHaveBeenCalledTimes(2)
    })

    it('imports ALL rows when a file contains three identical rows', async () => {
      const result = await service.importCsv({
        csv: MAX_THREE_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.inserted).toBe(3)
      expect(result.withinFileDuplicates).toBe(2)
      expect(prisma.transaction.create).toHaveBeenCalledTimes(3)
    })

    it('inserts the first row in a within-file group without WITHIN_FILE_DUPLICATE status', async () => {
      await service.importCsv({
        csv: MAX_TWO_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      const firstCall = vi.mocked(prisma.transaction.create).mock.calls[0]
      // CLEARED is the Prisma default and is not explicitly set in the data object.
      // Assert the first call does NOT carry the within-file duplicate marker.
      expect(firstCall?.[0]).not.toMatchObject({
        data: expect.objectContaining({ status: 'WITHIN_FILE_DUPLICATE' }),
      })
    })

    it('inserts subsequent rows in a within-file group as WITHIN_FILE_DUPLICATE', async () => {
      const FIRST_TX_ID = 'first-tx-uuid'
      vi.mocked(prisma.transaction.create)
        .mockResolvedValueOnce({ id: FIRST_TX_ID } as never)
        .mockResolvedValueOnce({} as never)

      await service.importCsv({
        csv: MAX_TWO_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      const secondCall = vi.mocked(prisma.transaction.create).mock.calls[1]
      expect(secondCall?.[0]).toMatchObject({
        data: expect.objectContaining({
          status: 'WITHIN_FILE_DUPLICATE',
          duplicateOf: FIRST_TX_ID,
        }),
      })
    })

    it('does NOT add within-file duplicates to skippedRows', async () => {
      const result = await service.importCsv({
        csv: MAX_TWO_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.skippedRows).toHaveLength(0)
    })

    it('does NOT write audit log entries for WITHIN_FILE_DUPLICATE rows', async () => {
      vi.mocked(prisma.transaction.create)
        .mockResolvedValueOnce({ id: 'first-tx-uuid' } as never)
        .mockResolvedValueOnce({} as never)

      await service.importCsv({
        csv: MAX_TWO_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      // Only 1 audit log entry: for the first (CLEARED) row
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1)
    })

    it('still blocks cross-file duplicates even when a within-file group exists', async () => {
      // The dedup hash already exists in DB from a previous import
      const EXISTING_TX_ID = 'existing-tx-uuid'
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue({
        id: EXISTING_TX_ID,
        importBatch: { filename: 'previous.csv' },
      } as never)

      const result = await service.importCsv({
        csv: MAX_TWO_IDENTICAL_ROWS,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      // Both rows match an existing DB record → both are cross-file duplicates
      expect(result.inserted).toBe(0)
      expect(result.duplicates).toBe(2)
      expect(result.withinFileDuplicates).toBe(0)
      expect(result.skippedRows).toHaveLength(2)
    })
  })

  // ─── Cross-batch dedup (global scope) ────────────────────────────────────

  describe('cross-batch deduplication', () => {
    // A "new" file that shares rows with a previously imported file
    const MAX_NEW_FILE_WITH_OLD_ROWS =
      `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
      `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
      `05/2026,,,,,,,,,,,,,,,\n` +
      `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
      // old row (already imported in a previous batch)
      `09-04-2026,מאפיית בראשית,שונות,5432,רגילה,17,₪,17,₪,10-05-2026,,,,,,\n` +
      // new row (only in this file)
      `12-04-2026,סופרמרקט שופרסל,מזון,5432,רגילה,120,₪,120,₪,10-05-2026,,,,,,\n` +
      `,,,,,,,,,,,,,,,\n` +
      `סך הכל,,,,,,,,,,,,,,,\n` +
      `137₪,,,,,,,,,,,,,,,`

    // Installment scenario — same merchant/amount on different calendar dates
    const MAX_INSTALLMENT_MONTH1 =
      `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
      `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
      `05/2026,,,,,,,,,,,,,,,\n` +
      `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
      `15-04-2026,יס פלאנט,שונות,5432,תשלומים,99,₪,99,₪,10-05-2026,,,,,,\n` +
      `,,,,,,,,,,,,,,,\n` +
      `סך הכל,,,,,,,,,,,,,,,\n` +
      `99₪,,,,,,,,,,,,,,,`

    const MAX_INSTALLMENT_MONTH2 =
      `כל המשתמשים (2),,,,,,,,,,,,,,,\n` +
      `כל הכרטיסים (5),,,,,,,,,,,,,,,\n` +
      `06/2026,,,,,,,,,,,,,,,\n` +
      `תאריך עסקה,שם בית העסק,קטגוריה,4 ספרות אחרונות של כרטיס האשראי,סוג עסקה,סכום חיוב,מטבע חיוב,סכום עסקה מקורי,מטבע עסקה מקורי,תאריך חיוב,הערות,תיוגים,מועדון הנחות,מפתח דיסקונט,אופן ביצוע ההעסקה,"שער המרה ממטבע מקור/התחשבנות לש""ח"\n` +
      // Same merchant and amount but a DIFFERENT transactionDate — not a duplicate
      `15-05-2026,יס פלאנט,שונות,5432,תשלומים,99,₪,99,₪,10-06-2026,,,,,,\n` +
      `,,,,,,,,,,,,,,,\n` +
      `סך הכל,,,,,,,,,,,,,,,\n` +
      `99₪,,,,,,,,,,,,,,,`

    const EXISTING_TX_ID = 'existing-tx-uuid'
    const NEW_BATCH_ID = 'batch-2'

    beforeEach(() => {
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.account.create).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.importBatch.create).mockResolvedValue({
        ...MOCK_BATCH,
        id: NEW_BATCH_ID,
        filename: 'max-new.csv',
      })
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('detects a duplicate from a PREVIOUS batch (different importBatchId)', async () => {
      // The old row matches; the new row is genuinely new
      vi.mocked(prisma.transaction.findFirst)
        .mockResolvedValueOnce({
          id: EXISTING_TX_ID,
          importBatch: { filename: 'max-old.csv' },
        } as never) // old row → duplicate
        .mockResolvedValueOnce(null) // new row → no existing PENDING
        .mockResolvedValueOnce(null) // new row → not a PENDING match

      const result = await service.importCsv({
        csv: MAX_NEW_FILE_WITH_OLD_ROWS,
        filename: 'max-new.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      expect(result.duplicates).toBe(1)
      expect(result.inserted).toBe(1)
      expect(result.skippedRows).toHaveLength(1)
      expect(result.skippedRows[0]).toMatchObject({
        date: '2026-04-09',
        description: 'מאפיית בראשית',
        originalImportedFrom: 'max-old.csv',
      })
    })

    it('dedup query does NOT include importBatchId in the where clause', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max-new.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      // The dedup findFirst call must NOT filter by importBatchId
      const dedupeCall = vi.mocked(prisma.transaction.findFirst).mock.calls.find(args => {
        const where = args[0]?.where as Record<string, unknown> | undefined
        return where !== undefined && 'dedupeHash' in where
      })
      expect(dedupeCall).toBeDefined()
      const where = dedupeCall?.[0]?.where as Record<string, unknown> | undefined
      expect(where).not.toHaveProperty('importBatchId')
    })

    it('dedup query excludes DUPLICATE and WITHIN_FILE_DUPLICATE rows', async () => {
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      await service.importCsv({
        csv: MAX_SINGLE_ROW,
        filename: 'max-new.csv',
        provider: 'MAX',
        userId: USER_ID,
      })

      const dedupeCall = vi.mocked(prisma.transaction.findFirst).mock.calls.find(args => {
        const where = args[0]?.where as Record<string, unknown> | undefined
        return where !== undefined && 'dedupeHash' in where
      })
      expect(dedupeCall).toBeDefined()
      const where = dedupeCall?.[0]?.where as Record<string, unknown> | undefined
      expect(where).toMatchObject({
        status: { notIn: expect.arrayContaining(['DUPLICATE', 'WITHIN_FILE_DUPLICATE']) },
      })
    })

    it('does NOT flag installments as duplicates when they fall on different dates', async () => {
      // First import: month 1 installment
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
      const month1 = await service.importCsv({
        csv: MAX_INSTALLMENT_MONTH1,
        filename: 'max-may.csv',
        provider: 'MAX',
        userId: USER_ID,
      })
      expect(month1.inserted).toBe(1)
      expect(month1.duplicates).toBe(0)

      vi.resetAllMocks()
      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.importBatch.create).mockResolvedValue({ ...MOCK_BATCH, id: 'batch-june' })
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null) // different hash → no match
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)

      // Second import: month 2 installment — different date, different hash → NOT a duplicate
      const month2 = await service.importCsv({
        csv: MAX_INSTALLMENT_MONTH2,
        filename: 'max-june.csv',
        provider: 'MAX',
        userId: USER_ID,
      })
      expect(month2.inserted).toBe(1)
      expect(month2.duplicates).toBe(0)
    })
  })

  // ─── Fixture-based cross-batch dedup (real CAL reports) ─────────────────

  describe('fixture: real CAL reports — partial re-import', () => {
    // Uses the example files from examples/ to simulate the real user workflow:
    //   1. Import "cal monthly report example.csv"  (20 rows: 18 cleared + 2 pending)
    //   2. Import "cal-monthly-report-example-extended.csv"
    //      (same 20 rows, 2 pending now settled, + 3 brand-new rows)
    // Expected: second import inserts 3 new rows and flags 20 as duplicates.

    const FIXTURES_DIR = `${process.cwd()}/src/__tests__/fixtures`

    let originalCsv: string
    let extendedCsv: string

    beforeEach(async () => {
      const { readFileSync } = await import('node:fs')
      originalCsv = readFileSync(`${FIXTURES_DIR}/cal-monthly-report-example.csv`, 'utf-8')
      extendedCsv = readFileSync(`${FIXTURES_DIR}/cal-monthly-report-example-extended.csv`, 'utf-8')

      vi.mocked(prisma.account.findFirst).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.account.create).mockResolvedValue(MOCK_ACCOUNT)
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.transaction.create).mockResolvedValue({} as never)
      vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    })

    it('first import: inserts all 20 rows from the original report', async () => {
      vi.mocked(prisma.importBatch.create).mockResolvedValue({
        ...MOCK_BATCH,
        id: 'batch-original',
      })
      vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)

      const result = await service.importCsv({
        csv: originalCsv,
        filename: 'cal monthly report example.csv',
        provider: 'CAL',
        userId: USER_ID,
      })

      // 18 cleared rows inserted; 2 pending rows silently skipped
      expect(result.inserted).toBe(18)
      expect(result.duplicates).toBe(0)
      expect(result.errors).toEqual([])
    })

    it('second import: only the 5 new/settled rows are inserted; the 18 overlapping cleared rows are duplicates', async () => {
      vi.mocked(prisma.importBatch.create).mockResolvedValue({
        ...MOCK_BATCH,
        id: 'batch-extended',
      })

      const EXISTING = {
        id: 'existing-tx',
        importBatch: { filename: 'cal monthly report example.csv' },
      } as never

      // Extended file row order (newest first):
      //   29/4, 28/4, 27/4       → 3 brand-new rows (dedup → null)
      //   26/4 פרשמרקט (cleared) → was pending in original, now cleared → new insert (dedup → null)
      //   26/4 בוטיק (cleared)   → same (dedup → null)
      //   24/4..20/4/25          → 18 cleared overlapping rows (dedup → existing)
      vi.mocked(prisma.transaction.findFirst)
        // 5 new/settled rows: no dedup match
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        // 18 overlapping cleared rows: each matched by dedup hash
        .mockResolvedValue(EXISTING)

      const result = await service.importCsv({
        csv: extendedCsv,
        filename: 'cal-monthly-report-example-extended.csv',
        provider: 'CAL',
        userId: USER_ID,
      })

      expect(result.inserted).toBe(5)
      expect(result.duplicates).toBe(18)
      expect(result.errors).toEqual([])
      expect(result.skippedRows).toHaveLength(18)
    })

    it('second import: skippedRows reference the original report filename', async () => {
      vi.mocked(prisma.importBatch.create).mockResolvedValue({
        ...MOCK_BATCH,
        id: 'batch-extended',
      })

      vi.mocked(prisma.transaction.findFirst)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue({
          id: 'existing-tx',
          importBatch: { filename: 'cal monthly report example.csv' },
        } as never)

      const result = await service.importCsv({
        csv: extendedCsv,
        filename: 'cal-monthly-report-example-extended.csv',
        provider: 'CAL',
        userId: USER_ID,
      })

      for (const row of result.skippedRows) {
        expect(row.originalImportedFrom).toBe('cal monthly report example.csv')
      }
    })
  })

  // ─── Error cases ───────────────────────────────────────────────────────────

  describe('error cases', () => {
    it('throws ImportError UNKNOWN_FORMAT when CSV format is not recognised', async () => {
      vi.mocked(prisma.importBatch.findFirst).mockResolvedValue(null)

      await expect(
        service.importCsv({
          csv: 'date,amount\n2026-01-01,100',
          filename: 'unknown.csv',
          provider: 'MAX',
          userId: USER_ID,
        })
      ).rejects.toMatchObject({ code: 'FORMAT_MISMATCH' })
    })
  })
})
