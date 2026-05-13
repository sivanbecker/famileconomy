import { initSentry } from './lib/sentry.js'
import Fastify, { type FastifyInstance } from 'fastify'
import { logger, pinoOptions } from './lib/logger.js'
import { registerSecurityPlugins } from './plugins/security.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'
import { importRoutes } from './routes/import.js'
import { transactionRoutes } from './routes/transactions.js'
import { transactionNotesRoutes } from './routes/transaction-notes.js'
import { driveRoutes } from './routes/drive.js'

initSentry()

export async function createApp(): Promise<FastifyInstance> {
  const isTest = process.env['NODE_ENV'] === 'test'
  const app = Fastify({
    // Pass pino options (not a pino instance) so Fastify's generic stays on RawServerDefault
    logger: isTest ? false : pinoOptions,
  })

  await registerSecurityPlugins(app)
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(importRoutes)
  await app.register(transactionRoutes)
  await app.register(transactionNotesRoutes)
  await app.register(driveRoutes)

  return app
}

// Entrypoint — not imported during tests
if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['PORT'] ?? 3001)
  const host = process.env['HOST'] ?? '0.0.0.0'

  createApp()
    .then(app => app.listen({ port, host }))
    .catch((err: unknown) => {
      logger.error({ err }, 'server failed to start')
      process.exit(1)
    })
}
