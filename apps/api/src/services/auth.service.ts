import * as argon2 from 'argon2'
import * as jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '../db/prisma.js'

// ─── Error codes ──────────────────────────────────────────────────────────────

export class AuthError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'AuthError'
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  email: string
  password: string
  name: string
}

export interface LoginInput {
  email: string
  password: string
}

export interface AuthResult {
  user: { id: string; email: string; name: string }
  accessToken: string
  refreshToken: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ARGON2_OPTIONS: argon2.Options = {
  type: argon2.argon2id,
  memoryCost: 65536,
  timeCost: 3,
  parallelism: 4,
}

const ACCESS_TOKEN_TTL = '15m'
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

// ─── Helpers ──────────────────────────────────────────────────────────────────

function jwtSecret(): string {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET env var is required')
  return secret
}

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex')
}

function generateRawToken(): string {
  return randomBytes(40).toString('hex')
}

// ─── AuthService ─────────────────────────────────────────────────────────────

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await prisma.user.findUnique({ where: { email: input.email } })
    if (existing) throw new AuthError('EMAIL_TAKEN')

    const passwordHash = await argon2.hash(input.password, ARGON2_OPTIONS)

    const user = await prisma.user.create({
      data: { email: input.email, passwordHash, name: input.name },
    })

    return this.#issueTokens(user)
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await prisma.user.findUnique({ where: { email: input.email } })

    // Always verify to prevent timing-based user enumeration.
    // When no user exists we still run verify() against a dummy hash so the
    // response time is indistinguishable from a wrong-password attempt.
    let valid = false
    if (user) {
      valid = await argon2.verify(user.passwordHash, input.password)
    } else {
      // Dummy work — result is discarded
      await argon2.hash(input.password, ARGON2_OPTIONS)
    }

    if (!user || !valid) throw new AuthError('INVALID_CREDENTIALS')

    return this.#issueTokens(user)
  }

  async refreshTokens(rawToken: string): Promise<AuthResult> {
    const tokenHash = hashToken(rawToken)

    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })
    if (!stored) throw new AuthError('INVALID_CREDENTIALS')

    if (stored.revokedAt) throw new AuthError('REFRESH_TOKEN_REVOKED')

    if (stored.usedAt) {
      // Replay attack — revoke the entire family
      await prisma.refreshToken.updateMany({
        where: { familyId: stored.familyId },
        data: { revokedAt: new Date() },
      })
      throw new AuthError('REFRESH_TOKEN_REUSE')
    }

    if (stored.expiresAt < new Date()) throw new AuthError('REFRESH_TOKEN_EXPIRED')

    // Mark old token as used
    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { usedAt: new Date() },
    })

    const user = await prisma.user.findUnique({ where: { id: stored.userId } })
    if (!user) throw new AuthError('INVALID_CREDENTIALS')

    return this.#issueTokens(user, stored.familyId)
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken)
    const stored = await prisma.refreshToken.findUnique({ where: { tokenHash } })

    // Idempotent — already revoked is fine
    if (!stored || stored.revokedAt) return

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    })
  }

  // ─── Private ────────────────────────────────────────────────────────────────

  async #issueTokens(
    user: { id: string; email: string; name: string },
    familyId?: string
  ): Promise<AuthResult> {
    const accessToken = jwt.sign({ sub: user.id, email: user.email }, jwtSecret(), {
      expiresIn: ACCESS_TOKEN_TTL,
    })

    const rawToken = generateRawToken()
    const tokenHash = hashToken(rawToken)
    const resolvedFamilyId = familyId ?? randomBytes(16).toString('hex')

    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash,
        familyId: resolvedFamilyId,
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    })

    return {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
      refreshToken: rawToken,
    }
  }
}
