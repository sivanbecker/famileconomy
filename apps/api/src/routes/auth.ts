import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { AuthService, AuthError } from '../services/auth.service.js'
import { registerSchema, loginSchema } from '../lib/schemas.js'

const COOKIE_NAME = 'refresh_token' as const
const COOKIE_TTL_MS = 7 * 24 * 60 * 60 * 1000

const AUTH_RATE_LIMIT_CONFIG = {
  config: {
    rateLimit: {
      max: 5,
      timeWindow: '1 minute',
    },
  },
} as const

function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: COOKIE_TTL_MS / 1000,
  })
}

function clearRefreshCookie(reply: FastifyReply): void {
  reply.setCookie(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 0,
  })
}

function mapAuthError(err: AuthError): number {
  switch (err.code) {
    case 'EMAIL_TAKEN':
      return 409
    case 'INVALID_CREDENTIALS':
    case 'REFRESH_TOKEN_REVOKED':
    case 'REFRESH_TOKEN_REUSE':
    case 'REFRESH_TOKEN_EXPIRED':
      return 401
    default:
      return 500
  }
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  const authService = new AuthService()

  // POST /auth/register
  app.post(
    '/auth/register',
    AUTH_RATE_LIMIT_CONFIG,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = registerSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }

      try {
        const result = await authService.register(parsed.data)
        setRefreshCookie(reply, result.refreshToken)
        return reply.status(201).send({ user: result.user, accessToken: result.accessToken })
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.status(mapAuthError(err)).send({ error: err.code })
        }
        throw err
      }
    }
  )

  // POST /auth/login
  app.post(
    '/auth/login',
    AUTH_RATE_LIMIT_CONFIG,
    async (req: FastifyRequest, reply: FastifyReply) => {
      const parsed = loginSchema.safeParse(req.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: 'VALIDATION_ERROR', issues: parsed.error.issues })
      }

      try {
        const result = await authService.login(parsed.data)
        setRefreshCookie(reply, result.refreshToken)
        return reply.send({ user: result.user, accessToken: result.accessToken })
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.status(mapAuthError(err)).send({ error: err.code })
        }
        throw err
      }
    }
  )

  // POST /auth/refresh
  app.post(
    '/auth/refresh',
    AUTH_RATE_LIMIT_CONFIG,
    async (req: FastifyRequest, reply: FastifyReply) => {
      // eslint-disable-next-line security/detect-object-injection
      const rawToken = req.cookies[COOKIE_NAME]
      if (!rawToken) {
        return reply.status(401).send({ error: 'MISSING_REFRESH_TOKEN' })
      }

      try {
        const result = await authService.refreshTokens(rawToken)
        setRefreshCookie(reply, result.refreshToken)
        return reply.send({ user: result.user, accessToken: result.accessToken })
      } catch (err) {
        if (err instanceof AuthError) {
          clearRefreshCookie(reply)
          return reply.status(mapAuthError(err)).send({ error: err.code })
        }
        throw err
      }
    }
  )

  // POST /auth/logout
  app.post(
    '/auth/logout',
    AUTH_RATE_LIMIT_CONFIG,
    async (req: FastifyRequest, reply: FastifyReply) => {
      // eslint-disable-next-line security/detect-object-injection
      const rawToken = req.cookies[COOKIE_NAME]
      if (rawToken) {
        await authService.logout(rawToken)
      }
      clearRefreshCookie(reply)
      return reply.status(204).send()
    }
  )
}
