import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import cookie from '@fastify/cookie'

export async function registerSecurityPlugins(app: FastifyInstance): Promise<void> {
  await app.register(helmet)

  await app.register(cors, {
    origin: process.env['ALLOWED_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  })

  await app.register(cookie)

  // Stricter rate limit on auth endpoints
  await app.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
    keyGenerator: req => req.ip,
  })
}
