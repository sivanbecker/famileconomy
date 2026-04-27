import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'
import * as argon2 from 'argon2'
import * as jwt from 'jsonwebtoken'
import { AuthService } from '../services/auth.service.js'
import { prisma } from '../db/prisma.js'

// Prisma is mocked globally via src/test/setup.ts
const db = prisma as unknown as {
  user: { findUnique: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> }
  refreshToken: {
    findUnique: ReturnType<typeof vi.fn>
    create: ReturnType<typeof vi.fn>
    update: ReturnType<typeof vi.fn>
    updateMany: ReturnType<typeof vi.fn>
  }
  auditLog: { create: ReturnType<typeof vi.fn> }
}

// noUncheckedIndexedAccess: use this helper instead of .mock.calls[0][0] directly
function firstCallArg(mockFn: ReturnType<typeof vi.fn>): unknown {
  const call = mockFn.mock.calls[0]
  if (!call) throw new Error('mock was never called')
  return call[0]
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-uuid-1',
    email: 'test@example.com',
    passwordHash: '$argon2id$placeholder',
    name: 'Test User',
    locale: 'he',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeRefreshToken(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rt-uuid-1',
    userId: 'user-uuid-1',
    tokenHash: 'stored-hash',
    familyId: 'family-uuid-1',
    usedAt: null,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    revokedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

const TEST_SECRET = 'test-secret-min-32-chars-long!!'

// ─── register ────────────────────────────────────────────────────────────────

describe('AuthService.register', () => {
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['JWT_SECRET'] = TEST_SECRET
    service = new AuthService()
    db.refreshToken.create.mockResolvedValue(makeRefreshToken())
  })

  it('creates a user with an Argon2id password hash', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue(makeUser())

    await service.register({
      email: 'test@example.com',
      password: 'S3cure!Pass',
      name: 'Test User',
    })

    expect(db.user.create).toHaveBeenCalledOnce()
    const hash = (firstCallArg(db.user.create) as { data: { passwordHash: string } }).data
      .passwordHash
    expect(hash).toMatch(/^\$argon2id\$/)
  })

  it('returns accessToken and refreshToken on success', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue(makeUser())

    const result = await service.register({
      email: 'test@example.com',
      password: 'S3cure!Pass',
      name: 'Test User',
    })

    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
  })

  it('stores the refresh token as a hash, never the raw token', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue(makeUser())

    const result = await service.register({
      email: 'test@example.com',
      password: 'S3cure!Pass',
      name: 'Test User',
    })

    const storedHash = (firstCallArg(db.refreshToken.create) as { data: { tokenHash: string } })
      .data.tokenHash
    expect(storedHash).toBeDefined()
    expect(storedHash).not.toBe(result.refreshToken)
  })

  it('throws EMAIL_TAKEN when email is already registered', async () => {
    db.user.findUnique.mockResolvedValue(makeUser())

    await expect(
      service.register({ email: 'test@example.com', password: 'S3cure!Pass', name: 'Test User' })
    ).rejects.toThrow('EMAIL_TAKEN')
  })

  it('does not store the plaintext password anywhere', async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.create.mockResolvedValue(makeUser())

    await service.register({
      email: 'test@example.com',
      password: 'S3cure!Pass',
      name: 'Test User',
    })

    const serialised = JSON.stringify(firstCallArg(db.user.create))
    expect(serialised).not.toContain('S3cure!Pass')
  })
})

// ─── login ────────────────────────────────────────────────────────────────────

describe('AuthService.login', () => {
  let service: AuthService
  let correctHash: string

  beforeAll(async () => {
    correctHash = await argon2.hash('correct-password')
  })

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['JWT_SECRET'] = TEST_SECRET
    service = new AuthService()
    db.refreshToken.create.mockResolvedValue(makeRefreshToken())
  })

  it('returns accessToken and refreshToken on valid credentials', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ passwordHash: correctHash }))

    const result = await service.login({ email: 'test@example.com', password: 'correct-password' })

    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
  })

  it('throws INVALID_CREDENTIALS on wrong password', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ passwordHash: correctHash }))

    await expect(
      service.login({ email: 'test@example.com', password: 'wrong-password' })
    ).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('throws INVALID_CREDENTIALS when user does not exist (prevents user enumeration)', async () => {
    db.user.findUnique.mockResolvedValue(null)

    await expect(
      service.login({ email: 'nobody@example.com', password: 'any-password' })
    ).rejects.toThrow('INVALID_CREDENTIALS')
  })

  it('access token expires in 15 minutes', async () => {
    db.user.findUnique.mockResolvedValue(makeUser({ passwordHash: correctHash }))

    const result = await service.login({ email: 'test@example.com', password: 'correct-password' })

    const decoded = jwt.verify(result.accessToken, TEST_SECRET) as { exp: number; iat: number }
    const ttlSeconds = decoded.exp - decoded.iat
    // 15 min = 900s; allow ±5s for test execution time
    expect(ttlSeconds).toBeGreaterThanOrEqual(895)
    expect(ttlSeconds).toBeLessThanOrEqual(905)
  })
})

// ─── refreshTokens ────────────────────────────────────────────────────────────

describe('AuthService.refreshTokens', () => {
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['JWT_SECRET'] = TEST_SECRET
    service = new AuthService()
  })

  it('returns new accessToken and refreshToken for a valid unused token', async () => {
    db.refreshToken.findUnique.mockResolvedValue(makeRefreshToken())
    db.refreshToken.update.mockResolvedValue(makeRefreshToken({ usedAt: new Date() }))
    db.refreshToken.create.mockResolvedValue(makeRefreshToken({ id: 'rt-uuid-2' }))
    db.user.findUnique.mockResolvedValue(makeUser())

    const result = await service.refreshTokens('some-valid-raw-token')

    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
  })

  it('marks the old token as used (one-time-use)', async () => {
    db.refreshToken.findUnique.mockResolvedValue(makeRefreshToken())
    db.refreshToken.update.mockResolvedValue(makeRefreshToken({ usedAt: new Date() }))
    db.refreshToken.create.mockResolvedValue(makeRefreshToken({ id: 'rt-uuid-2' }))
    db.user.findUnique.mockResolvedValue(makeUser())

    await service.refreshTokens('some-valid-raw-token')

    expect(db.refreshToken.update).toHaveBeenCalledOnce()
    const updateCall = firstCallArg(db.refreshToken.update) as { data: { usedAt: unknown } }
    expect(updateCall.data.usedAt).toBeDefined()
  })

  it('revokes entire token family on replay attack (token already used)', async () => {
    db.refreshToken.findUnique.mockResolvedValue(
      makeRefreshToken({ usedAt: new Date('2026-01-01T10:00:00Z') })
    )
    db.refreshToken.updateMany.mockResolvedValue({ count: 2 })

    await expect(service.refreshTokens('already-used-raw-token')).rejects.toThrow(
      'REFRESH_TOKEN_REUSE'
    )

    expect(db.refreshToken.updateMany).toHaveBeenCalledOnce()
    const call = firstCallArg(db.refreshToken.updateMany) as {
      where: { familyId: string }
      data: { revokedAt: unknown }
    }
    expect(call.where.familyId).toBe('family-uuid-1')
    expect(call.data.revokedAt).toBeDefined()
  })

  it('rejects an expired refresh token', async () => {
    db.refreshToken.findUnique.mockResolvedValue(
      makeRefreshToken({ expiresAt: new Date(Date.now() - 1000) })
    )

    await expect(service.refreshTokens('expired-raw-token')).rejects.toThrow(
      'REFRESH_TOKEN_EXPIRED'
    )
  })

  it('rejects a revoked refresh token', async () => {
    db.refreshToken.findUnique.mockResolvedValue(
      makeRefreshToken({ revokedAt: new Date('2026-01-01T09:00:00Z') })
    )

    await expect(service.refreshTokens('revoked-raw-token')).rejects.toThrow(
      'REFRESH_TOKEN_REVOKED'
    )
  })

  it('rejects when token hash is not found in DB', async () => {
    db.refreshToken.findUnique.mockResolvedValue(null)

    await expect(service.refreshTokens('unknown-raw-token')).rejects.toThrow('INVALID_CREDENTIALS')
  })
})

// ─── logout ───────────────────────────────────────────────────────────────────

describe('AuthService.logout', () => {
  let service: AuthService

  beforeEach(() => {
    vi.clearAllMocks()
    process.env['JWT_SECRET'] = TEST_SECRET
    service = new AuthService()
  })

  it('revokes the refresh token on logout', async () => {
    db.refreshToken.findUnique.mockResolvedValue(makeRefreshToken())
    db.refreshToken.update.mockResolvedValue(makeRefreshToken({ revokedAt: new Date() }))

    await service.logout('some-valid-raw-token')

    expect(db.refreshToken.update).toHaveBeenCalledOnce()
    const call = firstCallArg(db.refreshToken.update) as { data: { revokedAt: unknown } }
    expect(call.data.revokedAt).toBeDefined()
  })

  it('does not throw when token is already revoked (idempotent logout)', async () => {
    db.refreshToken.findUnique.mockResolvedValue(
      makeRefreshToken({ revokedAt: new Date('2026-01-01') })
    )

    await expect(service.logout('already-revoked-token')).resolves.not.toThrow()
  })
})
