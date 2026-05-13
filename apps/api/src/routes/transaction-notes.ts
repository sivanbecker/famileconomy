import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'
import { prisma } from '../db/prisma.js'

// ─── Schemas ──────────────────────────────────────────────────────────────────

const noteBodySchema = z.object({
  userId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

const userQuerySchema = z.object({
  userId: z.string().uuid(),
})

const patchNoteSchema = z.object({
  userId: z.string().uuid(),
  body: z.string().min(1).max(2000),
})

const deleteNoteSchema = z.object({
  userId: z.string().uuid(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function resolveTransaction(txId: string) {
  return prisma.transaction.findFirst({
    where: { id: txId },
    select: { id: true, account: { select: { userId: true } } },
  })
}

function ownerUserId(tx: { account: { userId: string } }): string {
  return tx.account.userId
}

// ─── Routes ───────────────────────────────────────────────────────────────────

export async function transactionNotesRoutes(app: FastifyInstance): Promise<void> {
  // POST /transactions/:id/notes
  app.post(
    '/transactions/:id/notes',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: txId } = req.params
      const parsed = noteBodySchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, body } = parsed.data

      const tx = await resolveTransaction(txId)
      if (!tx) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (ownerUserId(tx) !== userId) return reply.status(403).send({ error: 'FORBIDDEN' })

      const [note] = await prisma.$transaction([
        prisma.transactionNote.create({
          data: { transactionId: txId, body },
          select: { id: true, transactionId: true, body: true, createdAt: true, updatedAt: true },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'CREATE_NOTE',
            tableName: 'transaction_notes',
            recordId: txId,
            newValues: { body },
          },
        }),
      ])

      return reply.status(201).send({ note })
    }
  )

  // GET /transactions/:id/notes?userId=
  app.get(
    '/transactions/:id/notes',
    async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id: txId } = req.params
      const parsed = userQuerySchema.safeParse(req.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId } = parsed.data

      const tx = await resolveTransaction(txId)
      if (!tx) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (ownerUserId(tx) !== userId) return reply.status(403).send({ error: 'FORBIDDEN' })

      const notes = await prisma.transactionNote.findMany({
        where: { transactionId: txId },
        select: { id: true, transactionId: true, body: true, createdAt: true, updatedAt: true },
        orderBy: { createdAt: 'asc' },
      })

      return reply.send({ notes })
    }
  )

  // PATCH /transactions/:id/notes/:noteId
  app.patch(
    '/transactions/:id/notes/:noteId',
    async (
      req: FastifyRequest<{ Params: { id: string; noteId: string } }>,
      reply: FastifyReply
    ) => {
      const { id: txId, noteId } = req.params
      const parsed = patchNoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId, body } = parsed.data

      const tx = await resolveTransaction(txId)
      if (!tx) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (ownerUserId(tx) !== userId) return reply.status(403).send({ error: 'FORBIDDEN' })

      const existing = await prisma.transactionNote.findFirst({
        where: { id: noteId, transactionId: txId },
      })
      if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })

      const [note] = await prisma.$transaction([
        prisma.transactionNote.update({
          where: { id: noteId },
          data: { body },
          select: { id: true, transactionId: true, body: true, createdAt: true, updatedAt: true },
        }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'UPDATE_NOTE',
            tableName: 'transaction_notes',
            recordId: txId,
            oldValues: { body: existing.body },
            newValues: { body },
          },
        }),
      ])

      return reply.send({ note })
    }
  )

  // DELETE /transactions/:id/notes/:noteId
  app.delete(
    '/transactions/:id/notes/:noteId',
    async (
      req: FastifyRequest<{ Params: { id: string; noteId: string } }>,
      reply: FastifyReply
    ) => {
      const { id: txId, noteId } = req.params
      const parsed = deleteNoteSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }
      const { userId } = parsed.data

      const tx = await resolveTransaction(txId)
      if (!tx) return reply.status(404).send({ error: 'NOT_FOUND' })
      if (ownerUserId(tx) !== userId) return reply.status(403).send({ error: 'FORBIDDEN' })

      const existing = await prisma.transactionNote.findFirst({
        where: { id: noteId, transactionId: txId },
      })
      if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })

      await prisma.$transaction([
        prisma.transactionNote.delete({ where: { id: noteId } }),
        prisma.auditLog.create({
          data: {
            userId,
            action: 'DELETE_NOTE',
            tableName: 'transaction_notes',
            recordId: txId,
            oldValues: { body: existing.body },
          },
        }),
      ])

      return reply.status(204).send()
    }
  )
}
