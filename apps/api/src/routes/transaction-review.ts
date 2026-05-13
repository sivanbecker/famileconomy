import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'
import type { ReviewStatus } from '@prisma/client'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const REVIEW_STATUSES = ['USER_REVIEWED', 'USER_FLAGGED'] as const

const patchReviewSchema = z.object({
  userId: z.string().uuid(),
  reviewStatus: z.enum(REVIEW_STATUSES).nullable(),
})

const bulkReviewSchema = z.object({
  userId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(500),
  reviewStatus: z.enum(REVIEW_STATUSES).nullable(),
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function transactionReviewRoutes(app: FastifyInstance): Promise<void> {
  // PATCH /transactions/bulk-review — must be registered before /:id/review
  // so the literal segment wins over the param segment
  app.patch('/transactions/bulk-review', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = bulkReviewSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }
    const { userId, ids, reviewStatus } = parsed.data

    // Fetch only the transactions that belong to this user (security: ownership check)
    const owned = await prisma.transaction.findMany({
      where: {
        id: { in: ids },
        account: { userId },
      },
      select: { id: true, reviewStatus: true },
    })

    if (owned.length === 0) {
      return reply.send({ updated: 0 })
    }

    const ownedIds = owned.map(tx => tx.id)
    const prismaStatus: ReviewStatus | null = reviewStatus ?? null

    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { id: { in: ownedIds } },
        data: { reviewStatus: prismaStatus },
      }),
      ...ownedIds.map(id =>
        prisma.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_REVIEW_STATUS',
            tableName: 'transactions',
            recordId: id,
            oldValues: { reviewStatus: owned.find(tx => tx.id === id)?.reviewStatus ?? null },
            newValues: { reviewStatus },
          },
        })
      ),
    ])

    return reply.send({ updated: ownedIds.length })
  })

  // PATCH /transactions/:id/review
  app.patch(
    '/transactions/:id/review',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params
      const parsed = patchReviewSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, reviewStatus } = parsed.data

      const existing = await prisma.transaction.findFirst({
        where: { id },
        include: { account: { select: { userId: true } } },
      })
      if (!existing) {
        return reply.status(404).send({ error: 'NOT_FOUND' })
      }
      if (existing.account.userId !== userId) {
        return reply.status(403).send({ error: 'FORBIDDEN' })
      }

      const prismaStatus: ReviewStatus | null = reviewStatus ?? null

      const [updated] = await prisma.$transaction([
        prisma.transaction.update({
          where: { id },
          data: { reviewStatus: prismaStatus },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_REVIEW_STATUS',
            tableName: 'transactions',
            recordId: id,
            oldValues: { reviewStatus: existing.reviewStatus },
            newValues: { reviewStatus },
          },
        }),
      ])

      return reply.send({ reviewStatus: updated.reviewStatus })
    }
  )
}
