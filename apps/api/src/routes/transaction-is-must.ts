import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const isMustValue = z.boolean().nullable()

const patchIsMustSchema = z.object({
  userId: z.string().uuid(),
  isMust: isMustValue,
})

const bulkIsMustSchema = z.object({
  userId: z.string().uuid(),
  ids: z.array(z.string().uuid()).min(1).max(500),
  isMust: isMustValue,
})

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function transactionIsMustRoutes(app: FastifyInstance): Promise<void> {
  // PATCH /transactions/bulk-is-must — must be registered before /:id/is-must
  app.patch('/transactions/bulk-is-must', async (req: FastifyRequest, reply: FastifyReply) => {
    const parsed = bulkIsMustSchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
    }
    const { userId, ids, isMust } = parsed.data

    const owned = await prisma.transaction.findMany({
      where: {
        id: { in: ids },
        account: { userId },
      },
      select: { id: true, isMust: true },
    })

    if (owned.length === 0) {
      return reply.send({ updated: 0 })
    }

    const ownedIds = owned.map(tx => tx.id)

    await prisma.$transaction([
      prisma.transaction.updateMany({
        where: { id: { in: ownedIds } },
        data: { isMust },
      }),
      ...ownedIds.map(id =>
        prisma.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_IS_MUST',
            tableName: 'transactions',
            recordId: id,
            oldValues: { isMust: owned.find(tx => tx.id === id)?.isMust ?? null },
            newValues: { isMust },
          },
        })
      ),
    ])

    return reply.send({ updated: ownedIds.length })
  })

  // PATCH /transactions/:id/is-must
  app.patch(
    '/transactions/:id/is-must',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = req.params
      const parsed = patchIsMustSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, isMust } = parsed.data

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

      const [updated] = await prisma.$transaction([
        prisma.transaction.update({
          where: { id },
          data: { isMust },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_IS_MUST',
            tableName: 'transactions',
            recordId: id,
            oldValues: { isMust: existing.isMust },
            newValues: { isMust },
          },
        }),
      ])

      return reply.send({ isMust: updated.isMust })
    }
  )
}
