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

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TransactionRow {
  id: string
  transactionDate: string
  description: string
  amountAgorot: number
  category: string | null
  cardLastFour: string | null
  status: string
  installmentNum: number | null
  installmentOf: number | null
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
        // category is stored plaintext — safe to filter at DB level
        ...(category !== undefined ? { category } : {}),
      },
      select: {
        id: true,
        transactionDate: true,
        description: true,
        amountAgorot: true,
        category: true,
        cardLastFour: true,
        status: true,
        installmentNum: true,
        installmentOf: true,
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
      installmentNum: row.installmentNum,
      installmentOf: row.installmentOf,
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
