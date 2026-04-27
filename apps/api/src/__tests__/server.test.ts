import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { AuthService } from '../services/auth.service.js'
import { AuthError } from '../services/auth.service.js'

// ─── Static mocks — defined once, reconfigured per test ───────────────────────

vi.mock('../services/auth.service.js', () => {
  class AuthError extends Error {
    constructor(public readonly code: string) {
      super(code)
      this.name = 'AuthError'
    }
  }
  const AuthService = vi.fn().mockImplementation(
    () =>
      ({
        register: vi.fn(),
        login: vi.fn(),
        refreshTokens: vi.fn(),
        logout: vi.fn(),
      }) as unknown as InstanceType<typeof AuthService>
  )
  return { AuthService, AuthError }
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

type MockAuthServiceShape = {
  register: ReturnType<typeof vi.fn>
  login: ReturnType<typeof vi.fn>
  refreshTokens: ReturnType<typeof vi.fn>
  logout: ReturnType<typeof vi.fn>
}

function makeServiceImpl(overrides: Partial<MockAuthServiceShape>): AuthService {
  return {
    register: vi.fn(),
    login: vi.fn(),
    refreshTokens: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  } as unknown as AuthService
}

const SUCCESS_RESULT = {
  user: { id: 'user-1', email: 'a@b.com', name: 'A' },
  accessToken: 'access-tok',
  refreshToken: 'refresh-tok',
}

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

// ─── GET /health ──────────────────────────────────────────────────────────────

describe('GET /health', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })

  it('does not require authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).not.toBe(401)
    expect(res.statusCode).not.toBe(403)
  })
})

// ─── GET /ready ───────────────────────────────────────────────────────────────

describe('GET /ready', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with status ready', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ready' })
  })

  it('does not require authentication', async () => {
    const res = await app.inject({ method: 'GET', url: '/ready' })
    expect(res.statusCode).not.toBe(401)
    expect(res.statusCode).not.toBe(403)
  })
})

// ─── POST /auth/register ──────────────────────────────────────────────────────

describe('POST /auth/register', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({ register: vi.fn().mockResolvedValue(SUCCESS_RESULT) })
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 201 with user info on valid input', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@b.com', password: 'S3cure!Pass', name: 'A' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ user: { email: string } }>()
    expect(body.user.email).toBe('a@b.com')
  })

  it('sets httpOnly refresh token cookie on success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@b.com', password: 'S3cure!Pass', name: 'A' },
    })
    expect(res.statusCode).toBe(201)
    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
    expect(cookieStr).toContain('HttpOnly')
    expect(cookieStr).toContain('refresh_token')
  })

  it('does not return the refresh token in the response body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@b.com', password: 'S3cure!Pass', name: 'A' },
    })
    expect(res.statusCode).toBe(201)
    expect(res.body).not.toContain('refresh-tok')
  })

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { password: 'S3cure!Pass', name: 'A' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when password is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@b.com', name: 'A' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 when email is already taken', async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({ register: vi.fn().mockRejectedValue(new AuthError('EMAIL_TAKEN')) })
    )
    const localApp = await buildApp()
    const res = await localApp.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'taken@b.com', password: 'S3cure!Pass', name: 'A' },
    })
    await localApp.close()
    expect(res.statusCode).toBe(409)
  })
})

// ─── POST /auth/login ─────────────────────────────────────────────────────────

describe('POST /auth/login', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({ login: vi.fn().mockResolvedValue(SUCCESS_RESULT) })
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with accessToken on valid credentials', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'a@b.com', password: 'correct-password' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ accessToken: string }>()
    expect(typeof body.accessToken).toBe('string')
  })

  it('sets httpOnly refresh token cookie on success', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'a@b.com', password: 'correct-password' },
    })
    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
    expect(cookieStr).toContain('HttpOnly')
    expect(cookieStr).toContain('refresh_token')
  })

  it('returns 400 when email is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { password: 'correct-password' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 401 on invalid credentials', async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({ login: vi.fn().mockRejectedValue(new AuthError('INVALID_CREDENTIALS')) })
    )
    const localApp = await buildApp()
    const res = await localApp.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'a@b.com', password: 'wrong' },
    })
    await localApp.close()
    expect(res.statusCode).toBe(401)
  })
})

// ─── POST /auth/refresh ───────────────────────────────────────────────────────

describe('POST /auth/refresh', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({
        refreshTokens: vi.fn().mockResolvedValue({
          ...SUCCESS_RESULT,
          accessToken: 'new-access-tok',
          refreshToken: 'new-refresh-tok',
        }),
      })
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with new accessToken when cookie is present', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'some-valid-token' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ accessToken: string }>()
    expect(typeof body.accessToken).toBe('string')
  })

  it('rotates the refresh token cookie', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'some-valid-token' },
    })
    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
    expect(cookieStr).toContain('HttpOnly')
    expect(cookieStr).toContain('refresh_token')
  })

  it('returns 401 when no refresh token cookie is present', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/refresh' })
    expect(res.statusCode).toBe(401)
  })

  it('returns 401 on a revoked refresh token', async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({
        refreshTokens: vi.fn().mockRejectedValue(new AuthError('REFRESH_TOKEN_REVOKED')),
      })
    )
    const localApp = await buildApp()
    const res = await localApp.inject({
      method: 'POST',
      url: '/auth/refresh',
      cookies: { refresh_token: 'revoked-token' },
    })
    await localApp.close()
    expect(res.statusCode).toBe(401)
  })
})

// ─── POST /auth/logout ────────────────────────────────────────────────────────

describe('POST /auth/logout', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(AuthService).mockClear()
    vi.mocked(AuthService).mockImplementation(() =>
      makeServiceImpl({ logout: vi.fn().mockResolvedValue(undefined) })
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 204 on logout with cookie present', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { refresh_token: 'some-valid-token' },
    })
    expect(res.statusCode).toBe(204)
  })

  it('clears the refresh token cookie on logout', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      cookies: { refresh_token: 'some-valid-token' },
    })
    const setCookie = res.headers['set-cookie']
    const cookieStr = Array.isArray(setCookie) ? setCookie.join('; ') : (setCookie ?? '')
    expect(cookieStr).toContain('refresh_token')
    const hasExpired = cookieStr.includes('Max-Age=0') || cookieStr.includes('Expires=')
    expect(hasExpired).toBe(true)
  })

  it('returns 204 even when no cookie is present (idempotent)', async () => {
    const res = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(res.statusCode).toBe(204)
  })
})
