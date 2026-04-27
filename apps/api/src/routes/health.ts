import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

export async function healthRoutes(app: FastifyInstance): Promise<void> {
  app.get('/health', async (_req, reply) => {
    return reply.send({ status: 'ok' })
  })

  app.get('/ready', async (_req, reply) => {
    await prisma.$connect()
    return reply.send({ status: 'ready' })
  })
}
