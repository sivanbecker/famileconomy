import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import { TransactionStatus } from '@prisma/client'

const userQuerySchema = z.object({
  userId: z.string().uuid(),
})

const querySchema = z.object({
  accountId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
})

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

  // GET /transactions?accountId=&year=&month=
  // Returns CLEARED + REVIEWED_OK transactions for the given account/month.
  // Excludes DUPLICATE rows — those are internal dedup records, not user-visible.
  app.get('/transactions', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = querySchema.safeParse(req.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }

    const { accountId, year, month } = parsed.data

    const startDate = new Date(year, month - 1, 1)
    const endDate = new Date(year, month, 1) // exclusive upper bound

    const rows = await prisma.transaction.findMany({
      where: {
        accountId,
        status: { in: [TransactionStatus.CLEARED, TransactionStatus.REVIEWED_OK] },
        OR: [
          // Transactions with a charge date (CAL installments etc.) — filter by billing month
          { chargeDate: { gte: startDate, lt: endDate } },
          // Transactions without a charge date (MAX etc.) — filter by purchase date
          { chargeDate: null, transactionDate: { gte: startDate, lt: endDate } },
        ],
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
      orderBy: { transactionDate: 'desc' },
    })

    const transactions: TransactionRow[] = rows.map(row => ({
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

    return reply.send({ transactions })
  })
}
