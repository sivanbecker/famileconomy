import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { GoogleOAuthService } from '../services/google-oauth.service.js'
import { getDriveImportQueue, generateDriveImportJobId } from '../lib/queue.js'

const uuidSchema = z.string().uuid()
const driveResourceTypeSchema = z.enum(['folder', 'file'])

const connectQuerySchema = z.object({
  userId: uuidSchema,
})

const callbackQuerySchema = z.object({
  code: z.string(),
  state: z.string(),
})

const statusQuerySchema = z.object({
  userId: uuidSchema,
})

const disconnectBodySchema = z.object({
  userId: uuidSchema,
})

const driveImportBodySchema = z.object({
  userId: uuidSchema,
  type: driveResourceTypeSchema,
  resourceId: z.string().min(1),
})

const jobIdParamSchema = z.object({
  jobId: z.string().regex(/^[a-f0-9]{64}$/),
})

export async function driveRoutes(app: FastifyInstance): Promise<void> {
  const oauthService = new GoogleOAuthService()

  // GET /auth/google/connect
  app.get<{ Querystring: { userId?: string } }>('/auth/google/connect', async (req, reply) => {
    const result = connectQuerySchema.safeParse(req.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR' })
    }

    const { userId } = result.data
    const authUrl = oauthService.buildAuthUrl(userId)

    return reply.status(200).send({ authUrl })
  })

  // GET /auth/google/callback
  app.get<{ Querystring: { code?: string; state?: string } }>(
    '/auth/google/callback',
    async (req, reply) => {
      const result = callbackQuerySchema.safeParse(req.query)
      if (!result.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR' })
      }

      const { code, state } = result.data

      try {
        await oauthService.exchangeCode(code, state)
        const redirect =
          process.env.GOOGLE_OAUTH_SUCCESS_REDIRECT || '/dashboard?googleConnected=true'
        return reply.redirect(redirect, 302)
      } catch {
        const redirect =
          process.env.GOOGLE_OAUTH_FAILURE_REDIRECT || '/dashboard?googleConnected=false'
        return reply.redirect(redirect, 302)
      }
    }
  )

  // GET /auth/google/status
  app.get<{ Querystring: { userId?: string } }>('/auth/google/status', async (req, reply) => {
    const result = statusQuerySchema.safeParse(req.query)
    if (!result.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR' })
    }

    const { userId } = result.data
    const connected = await oauthService.isConnected(userId)

    return reply.status(200).send({ connected })
  })

  // DELETE /auth/google/disconnect
  app.delete<{ Body: { userId?: string } }>('/auth/google/disconnect', async (req, reply) => {
    const result = disconnectBodySchema.safeParse(req.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR' })
    }

    const { userId } = result.data
    await oauthService.disconnect(userId)

    return reply.status(200).send({ status: 'disconnected' })
  })

  // POST /drive/import
  app.post<{ Body: { userId?: string; type?: string; resourceId?: string } }>(
    '/drive/import',
    async (req, reply) => {
      const result = driveImportBodySchema.safeParse(req.body)
      if (!result.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR' })
      }

      const { userId, type, resourceId } = result.data

      const connected = await oauthService.isConnected(userId)
      if (!connected) {
        return reply.status(409).send({ error: 'NOT_CONNECTED' })
      }

      const jobId = generateDriveImportJobId(userId, type, resourceId)
      const queue = getDriveImportQueue()

      try {
        await queue.add(jobId, { userId, type, resourceId }, { jobId })
        return reply.status(202).send({ jobId })
      } catch (error) {
        if (error instanceof Error && error.message.includes('UNPROCESSABLE_ENTITY')) {
          return reply.status(409).send({ error: 'JOB_ALREADY_QUEUED' })
        }
        throw error
      }
    }
  )

  // GET /drive/import/:jobId
  app.get<{ Params: { jobId?: string } }>('/drive/import/:jobId', async (req, reply) => {
    const result = jobIdParamSchema.safeParse(req.params)
    if (!result.success) {
      return reply.status(400).send({ error: 'VALIDATION_ERROR' })
    }

    const { jobId } = result.data
    const queue = getDriveImportQueue()
    const job = await queue.getJob(jobId)

    if (!job) {
      return reply.status(404).send({ error: 'JOB_NOT_FOUND' })
    }

    const state = await job.getState()
    const progressCall = job.progress as unknown
    const progressValue = typeof progressCall === 'function' ? progressCall() : progressCall

    return reply.status(200).send({
      jobId,
      status: state,
      progress:
        typeof progressValue === 'object' && progressValue !== null
          ? progressValue
          : {
              phase: 'waiting',
              totalFiles: 0,
              processedFiles: 0,
              inserted: 0,
              duplicates: 0,
              errors: [],
            },
    })
  })
}
