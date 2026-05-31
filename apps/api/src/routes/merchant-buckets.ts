import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { TransactionStatus } from '@prisma/client'
import type { TransactionRow, MerchantSummary } from './transactions.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const SORT_FIELDS = ['date', 'amount', 'category', 'description'] as const
type SortField = (typeof SORT_FIELDS)[number]

const createBucketSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1),
  descriptions: z.array(z.string().min(1)).min(1),
})

const listBucketsSchema = z.object({
  userId: z.string().uuid(),
})

const getBucketSchema = z.object({
  userId: z.string().uuid(),
})

const renameBucketSchema = z.object({
  userId: z.string().uuid(),
  name: z.string().min(1),
})

const addDescriptionSchema = z.object({
  userId: z.string().uuid(),
  description: z.string().min(1),
})

const removeDescriptionSchema = z.object({
  userId: z.string().uuid(),
  description: z.string().min(1),
})

const deleteBucketSchema = z.object({
  userId: z.string().uuid(),
})

const bucketTransactionsSchema = z
  .object({
    userId: z.string().uuid(),
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

const searchDescriptionsSchema = z.object({
  userId: z.string().uuid(),
  q: z.string().min(1),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBucket(bucket: {
  id: string
  name: string
  descriptions: { description: string }[]
}) {
  return {
    id: bucket.id,
    name: bucket.name,
    descriptions: bucket.descriptions.map(d => d.description),
  }
}

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

export async function merchantBucketRoutes(app: FastifyInstance): Promise<void> {
  // GET /merchant-buckets/search-descriptions?userId=&q=
  // Must be registered before /:id routes to avoid param conflict
  app.get(
    '/merchant-buckets/search-descriptions',
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = searchDescriptionsSchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, q } = parsed.data

      const accounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
      })
      if (accounts.length === 0) return reply.send({ descriptions: [] })

      const rows = await prisma.transaction.findMany({
        where: {
          accountId: { in: accounts.map(a => a.id) },
          status: {
            in: [
              TransactionStatus.CLEARED,
              TransactionStatus.REVIEWED_OK,
              TransactionStatus.WITHIN_FILE_DUPLICATE,
            ],
          },
        },
        select: { description: true },
      })

      const needle = q.toLowerCase()
      const seen = new Set<string>()
      const descriptions: string[] = []
      for (const row of rows) {
        const desc = row.description.toString('utf-8')
        if (desc.toLowerCase().includes(needle) && !seen.has(desc)) {
          seen.add(desc)
          descriptions.push(desc)
        }
      }

      return reply.send({ descriptions })
    }
  )

  // POST /merchant-buckets
  app.post('/merchant-buckets', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = createBucketSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }
    const { userId, name, descriptions } = parsed.data

    const bucket = await prisma.merchantBucket.create({
      data: {
        userId,
        name,
        descriptions: {
          create: descriptions.map(description => ({ description })),
        },
      },
      include: { descriptions: true },
    })

    return reply.status(201).send({ bucket: formatBucket(bucket) })
  })

  // GET /merchant-buckets?userId=
  app.get('/merchant-buckets', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = listBucketsSchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }

    const buckets = await prisma.merchantBucket.findMany({
      where: { userId: parsed.data.userId },
      include: { descriptions: { orderBy: { addedAt: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    })

    return reply.send({ buckets: buckets.map(formatBucket) })
  })

  // GET /merchant-buckets/:id?userId=
  app.get(
    '/merchant-buckets/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = getBucketSchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }

      const bucket = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId: parsed.data.userId },
        include: { descriptions: { orderBy: { addedAt: 'asc' } } },
      })
      if (!bucket) return reply.status(404).send({ error: 'NOT_FOUND' })

      return reply.send({ bucket: formatBucket(bucket) })
    }
  )

  // PATCH /merchant-buckets/:id — rename
  app.patch(
    '/merchant-buckets/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = renameBucketSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, name } = parsed.data

      const existing = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId },
      })
      if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })

      const updated = await prisma.merchantBucket.update({
        where: { id: req.params.id },
        data: { name },
        include: { descriptions: { orderBy: { addedAt: 'asc' } } },
      })

      return reply.send({ bucket: formatBucket(updated) })
    }
  )

  // POST /merchant-buckets/:id/descriptions — add description to bucket
  app.post(
    '/merchant-buckets/:id/descriptions',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = addDescriptionSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, description } = parsed.data

      const existing = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId },
      })
      if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })

      await prisma.merchantBucketDescription.create({
        data: { bucketId: req.params.id, description },
      })

      const updated = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId },
        include: { descriptions: { orderBy: { addedAt: 'asc' } } },
      })

      return reply.send({ descriptions: updated?.descriptions.map(d => d.description) ?? [] })
    }
  )

  // DELETE /merchant-buckets/:id/descriptions — remove description from bucket
  app.delete(
    '/merchant-buckets/:id/descriptions',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = removeDescriptionSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, description } = parsed.data

      const existing = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId },
      })
      if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })

      await prisma.merchantBucketDescription.deleteMany({
        where: { bucketId: req.params.id, description },
      })

      const updated = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId },
        include: { descriptions: { orderBy: { addedAt: 'asc' } } },
      })

      return reply.send({ descriptions: updated?.descriptions.map(d => d.description) ?? [] })
    }
  )

  // DELETE /merchant-buckets/:id — delete entire bucket
  app.delete(
    '/merchant-buckets/:id',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = deleteBucketSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }

      const existing = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId: parsed.data.userId },
      })
      if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })

      await prisma.merchantBucket.delete({ where: { id: req.params.id } })
      return reply.status(204).send()
    }
  )

  // GET /merchant-buckets/:id/transactions?userId=&year=...
  app.get(
    '/merchant-buckets/:id/transactions',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const parsed = bucketTransactionsSchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, year, search, category, minAmount, maxAmount, sortBy, sortDir, isMust } =
        parsed.data

      const bucket = await prisma.merchantBucket.findFirst({
        where: { id: req.params.id, userId },
        include: { descriptions: true },
      })
      if (!bucket) return reply.status(404).send({ error: 'NOT_FOUND' })

      const needles = new Set(bucket.descriptions.map(d => d.description.toLowerCase()))
      if (needles.size === 0) {
        const summary: MerchantSummary = {
          totalAgorot: 0,
          count: 0,
          avgMonthlyAgorot: 0,
          firstSeen: null,
          lastSeen: null,
        }
        return reply.send({ transactions: [], summary })
      }

      const userAccounts = await prisma.account.findMany({
        where: { userId },
        select: { id: true },
      })
      if (userAccounts.length === 0) {
        const summary: MerchantSummary = {
          totalAgorot: 0,
          count: 0,
          avgMonthlyAgorot: 0,
          firstSeen: null,
          lastSeen: null,
        }
        return reply.send({ transactions: [], summary })
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

      // Decrypt and filter to descriptions in this bucket
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
        .filter(tx => needles.has(tx.description.toLowerCase()))

      // Post-decrypt filters
      if (year !== undefined) {
        transactions = transactions.filter(
          tx => new Date(tx.transactionDate).getFullYear() === year
        )
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
        transactions = transactions.filter(tx =>
          tx.description.toLowerCase().includes(searchNeedle)
        )
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

      const distinctMonths = new Set(expenses.map(tx => tx.transactionDate.slice(0, 7)))
      const avgMonthlyAgorot =
        distinctMonths.size > 0 ? Math.floor(totalAgorot / distinctMonths.size) : 0

      const dates = expenses.map(tx => tx.transactionDate).sort()
      const firstSeen = dates[0] ?? null
      const lastSeen = dates[dates.length - 1] ?? null

      const summary: MerchantSummary = { totalAgorot, count, avgMonthlyAgorot, firstSeen, lastSeen }
      return reply.send({ transactions, summary })
    }
  )
}
