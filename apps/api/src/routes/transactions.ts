import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { TransactionStatus } from '@prisma/client'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const userQuerySchema = z.object({
  userId: z.string().uuid(),
})

const SORT_FIELDS = ['date', 'amount', 'category', 'description'] as const
type SortField = (typeof SORT_FIELDS)[number]

const querySchema = z
  .object({
    accountId: z.string().uuid().optional(),
    userId: z.string().uuid().optional(),
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
    // Filters
    search: z.string().optional(),
    category: z.string().optional(),
    minAmount: z.coerce.number().int().min(0).optional(),
    maxAmount: z.coerce.number().int().min(0).optional(),
    // Sorting
    sortBy: z.enum(SORT_FIELDS).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    // Classification filter
    isMust: z.enum(['true', 'false']).optional(),
  })
  .refine(d => d.accountId !== undefined || d.userId !== undefined, {
    message: 'Either accountId or userId must be provided',
  })
  .refine(
    d => d.minAmount === undefined || d.maxAmount === undefined || d.minAmount <= d.maxAmount,
    { message: 'minAmount must not exceed maxAmount' }
  )

const patchCategorySchema = z.object({
  userId: z.string().uuid(),
  category: z.string().min(1).nullable(),
})

const merchantQuerySchema = z
  .object({
    userId: z.string().uuid(),
    merchant: z.string().min(1),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    search: z.string().optional(),
    category: z.string().optional(),
    minAmount: z.coerce.number().int().min(0).optional(),
    maxAmount: z.coerce.number().int().min(0).optional(),
    sortBy: z.enum(SORT_FIELDS).optional(),
    sortDir: z.enum(['asc', 'desc']).optional(),
    isMust: z.enum(['true', 'false']).optional(),
  })
  .refine(
    d => d.minAmount === undefined || d.maxAmount === undefined || d.minAmount <= d.maxAmount,
    { message: 'minAmount must not exceed maxAmount' }
  )

export interface MerchantSummary {
  totalAgorot: number
  count: number
  avgMonthlyAgorot: number
  firstSeen: string | null
  lastSeen: string | null
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionRow {
  id: string
  transactionDate: string
  description: string
  amountAgorot: number
  category: string | null
  cardLastFour: string | null
  status: string
  reviewStatus: string | null
  installmentNum: number | null
  installmentOf: number | null
  notes: string | null
  isMust: boolean | null
}

export interface AccountRow {
  id: string
  name: string
  type: string
  currency: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildOrderBy(sortBy: SortField | undefined, sortDir: 'asc' | 'desc' | undefined) {
  const dir = sortDir ?? 'desc'
  switch (sortBy) {
    case 'amount':
      return { amountAgorot: dir }
    case 'category':
      return { category: dir }
    case 'description':
      return { description: dir }
    case 'date':
    default:
      return { transactionDate: dir }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function transactionRoutes(app: FastifyInstance): Promise<void> {
  // GET /accounts?userId=
  app.get('/accounts', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = userQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }

    const rows = await prisma.account.findMany({
      where: { userId: parsed.data.userId },
      select: { id: true, name: true, type: true, currency: true },
      orderBy: { createdAt: 'asc' },
    })

    const accounts: AccountRow[] = rows.map(row => ({
      id: row.id,
      name: row.name.toString('utf-8'),
      type: row.type,
      currency: row.currency,
    }))

    return reply.send({ accounts })
  })

  // GET /transactions/by-merchant?userId=&merchant=[&year=&search=&category=&minAmount=&maxAmount=&sortBy=&sortDir=&isMust=]
  app.get('/transactions/by-merchant', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = merchantQuerySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }

    const {
      userId,
      merchant,
      year,
      search,
      category,
      minAmount,
      maxAmount,
      sortBy,
      sortDir,
      isMust,
    } = parsed.data

    const userAccounts = await prisma.account.findMany({
      where: { userId },
      select: { id: true },
    })
    if (userAccounts.length === 0) {
      return reply.send({
        transactions: [],
        summary: { totalAgorot: 0, count: 0, avgMonthlyAgorot: 0, firstSeen: null, lastSeen: null },
      })
    }

    const yearFilter =
      year !== undefined
        ? { transactionDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
        : {}

    const rows = await prisma.transaction.findMany({
      where: {
        accountId: { in: userAccounts.map(a => a.id) },
        status: {
          in: [
            TransactionStatus.CLEARED,
            TransactionStatus.REVIEWED_OK,
            TransactionStatus.WITHIN_FILE_DUPLICATE,
          ],
        },
        ...yearFilter,
        ...(category !== undefined ? { category } : {}),
        ...(isMust !== undefined ? { isMust: isMust === 'true' ? true : { not: true } } : {}),
      },
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amountAgorot: true,
        category: true,
        cardLastFour: true,
        status: true,
        reviewStatus: true,
        installmentNum: true,
        installmentOf: true,
        notes: true,
        isMust: true,
      },
      orderBy:
        sortBy === 'date' || sortBy === 'category' || sortBy === undefined
          ? buildOrderBy(sortBy, sortDir)
          : { transactionDate: 'desc' },
    })

    // Decrypt and filter to the requested merchant
    const needle = merchant.toLowerCase()
    let transactions: TransactionRow[] = rows
      .map(row => ({
        id: row.id,
        transactionDate: row.transactionDate.toISOString().slice(0, 10),
        description: row.description.toString('utf-8'),
        amountAgorot: parseInt(row.amountAgorot.toString('utf-8'), 10),
        category: row.category,
        cardLastFour: row.cardLastFour,
        status: row.status,
        reviewStatus: row.reviewStatus,
        installmentNum: row.installmentNum,
        installmentOf: row.installmentOf,
        notes: row.notes,
        isMust: row.isMust,
      }))
      .filter(tx => tx.description.toLowerCase() === needle)

    // Post-decrypt filters (year, isMust, search, amounts all operate on plaintext)
    if (year !== undefined) {
      transactions = transactions.filter(tx => new Date(tx.transactionDate).getFullYear() === year)
    }
    if (isMust !== undefined) {
      if (isMust === 'true') {
        transactions = transactions.filter(tx => tx.isMust === true)
      } else {
        transactions = transactions.filter(tx => tx.isMust !== true)
      }
    }
    if (search !== undefined) {
      const searchNeedle = search.toLowerCase()
      transactions = transactions.filter(tx => tx.description.toLowerCase().includes(searchNeedle))
    }
    if (minAmount !== undefined) {
      transactions = transactions.filter(tx => tx.amountAgorot >= minAmount)
    }
    if (maxAmount !== undefined) {
      transactions = transactions.filter(tx => tx.amountAgorot <= maxAmount)
    }

    // Post-decrypt sort
    if (sortBy === 'amount' || sortBy === 'description') {
      const dir = sortDir ?? 'desc'
      transactions.sort((a, b) => {
        const aVal = sortBy === 'amount' ? a.amountAgorot : a.description
        const bVal = sortBy === 'amount' ? b.amountAgorot : b.description
        if (aVal < bVal) return dir === 'asc' ? -1 : 1
        if (aVal > bVal) return dir === 'asc' ? 1 : -1
        return 0
      })
    }

    // Compute summary
    const expenses = transactions.filter(tx => tx.amountAgorot > 0)
    const totalAgorot = expenses.reduce((sum, tx) => sum + tx.amountAgorot, 0)
    const count = transactions.length

    const distinctMonths = new Set(
      expenses.map(tx => tx.transactionDate.slice(0, 7)) // "YYYY-MM"
    )
    const avgMonthlyAgorot =
      distinctMonths.size > 0 ? Math.floor(totalAgorot / distinctMonths.size) : 0

    const dates = expenses.map(tx => tx.transactionDate).sort()
    const firstSeen = dates[0] ?? null
    const lastSeen = dates[dates.length - 1] ?? null

    const summary: MerchantSummary = { totalAgorot, count, avgMonthlyAgorot, firstSeen, lastSeen }

    return reply.send({ transactions, summary })
  })

  // GET /transactions?accountId=&year=&month=[&search=&category=&minAmount=&maxAmount=&sortBy=&sortDir=]
  app.get('/transactions', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }

    const {
      accountId,
      userId,
      year,
      month,
      search,
      category,
      minAmount,
      maxAmount,
      sortBy,
      sortDir,
      isMust,
    } = parsed.data

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1) // exclusive upper bound

    // Resolve the set of account IDs to query
    let accountIdFilter: { accountId: string } | { accountId: { in: string[] } }
    if (accountId !== undefined) {
      accountIdFilter = { accountId }
    } else if (userId !== undefined) {
      const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
      })
      if (userAccounts.length === 0) return reply.send({ transactions: [] })
      accountIdFilter = { accountId: { in: userAccounts.map(a => a.id) } }
    } else {
      return reply.status(400).send({ error: 'VALIDATION_ERROR' })
    }

    const rows = await prisma.transaction.findMany({
      where: {
        ...accountIdFilter,
        status: {
          in: [
            TransactionStatus.CLEARED,
            TransactionStatus.REVIEWED_OK,
            TransactionStatus.WITHIN_FILE_DUPLICATE,
          ],
        },
        OR: [
          { chargeDate: { gte: startDate, lt: endDate } },
          { chargeDate: null, transactionDate: { gte: startDate, lt: endDate } },
        ],
        // category and isMust are stored plaintext — safe to filter at DB level
        ...(category !== undefined ? { category } : {}),
        // isMust=true: only explicitly true; isMust=false: null (default) or false both mean "not must"
        ...(isMust !== undefined ? { isMust: isMust === 'true' ? true : { not: true } } : {}),
      },
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amountAgorot: true,
        category: true,
        cardLastFour: true,
        status: true,
        reviewStatus: true,
        installmentNum: true,
        installmentOf: true,
        notes: true,
        isMust: true,
      },
      // Default DB sort; amount/description sorts are applied after decryption below
      orderBy:
        sortBy === 'date' || sortBy === 'category' || sortBy === undefined
          ? buildOrderBy(sortBy, sortDir)
          : { transactionDate: 'desc' },
    })

    // Decrypt rows
    let transactions: TransactionRow[] = rows.map(row => ({
      id: row.id,
      transactionDate: row.transactionDate.toISOString().slice(0, 10),
      description: row.description.toString('utf-8'),
      amountAgorot: parseInt(row.amountAgorot.toString('utf-8'), 10),
      category: row.category,
      cardLastFour: row.cardLastFour,
      status: row.status,
      reviewStatus: row.reviewStatus,
      installmentNum: row.installmentNum,
      installmentOf: row.installmentOf,
      notes: row.notes,
      isMust: row.isMust,
    }))

    // Post-decrypt filters (description search and amount range operate on plaintext)
    if (search !== undefined) {
      const needle = search.toLowerCase()
      transactions = transactions.filter(tx => tx.description.toLowerCase().includes(needle))
    }
    if (minAmount !== undefined) {
      transactions = transactions.filter(tx => tx.amountAgorot >= minAmount)
    }
    if (maxAmount !== undefined) {
      transactions = transactions.filter(tx => tx.amountAgorot <= maxAmount)
    }

    // Post-decrypt sorts (amount and description need plaintext values)
    if (sortBy === 'amount' || sortBy === 'description') {
      const dir = sortDir ?? 'desc'
      transactions.sort((a, b) => {
        const aVal = sortBy === 'amount' ? a.amountAgorot : a.description
        const bVal = sortBy === 'amount' ? b.amountAgorot : b.description
        if (aVal < bVal) return dir === 'asc' ? -1 : 1
        if (aVal > bVal) return dir === 'asc' ? 1 : -1
        return 0
      })
    }

    return reply.send({ transactions })
  })

  // PATCH /transactions/:id/category
  app.patch(
    '/transactions/:id/category',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params
      const parsed = patchCategorySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, category } = parsed.data

      const existing = await prisma.transaction.findFirst({ where: { id } })
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND' })
      }

      const [updated] = await prisma.$transaction([
        prisma.transaction.update({ where: { id }, data: { category } }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_CATEGORY',
            tableName: 'transactions',
            recordId: id,
            oldValues: { category: existing.category },
            newValues: { category },
          },
        }),
      ])

      return reply.send({ category: updated.category })
    }
  )
}
