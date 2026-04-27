import Fastify, { type FastifyInstance } from 'fastify'
import { registerSecurityPlugins } from './plugins/security.js'
import { healthRoutes } from './routes/health.js'
import { authRoutes } from './routes/auth.js'

export async function createApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env['NODE_ENV'] !== 'test',
  })

  await registerSecurityPlugins(app)
  await app.register(healthRoutes)
  await app.register(authRoutes)

  return app
}

// Entrypoint — not imported during tests
if (process.env['NODE_ENV'] !== 'test') {
  const port = Number(process.env['PORT'] ?? 3001)
  const host = process.env['HOST'] ?? '0.0.0.0'

  createApp()
    .then(app => app.listen({ port, host }))
    .catch((err: unknown) => {
      console.error(err)
      process.exit(1)
    })
}
