import { createHmac } from 'node:crypto'
import { google, type Auth } from 'googleapis'
import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'

function jwtSecret(): string {
  const secret = process.env['JWT_SECRET']
  if (!secret) throw new Error('JWT_SECRET env var not set')
  return secret
}

function clientId(): string {
  const id = process.env['GOOGLE_CLIENT_ID']
  if (!id) throw new Error('GOOGLE_CLIENT_ID env var not set')
  return id
}

function clientSecret(): string {
  const secret = process.env['GOOGLE_CLIENT_SECRET']
  if (!secret) throw new Error('GOOGLE_CLIENT_SECRET env var not set')
  return secret
}

function redirectUri(): string {
  const uri = process.env['GOOGLE_REDIRECT_URI']
  if (!uri) throw new Error('GOOGLE_REDIRECT_URI env var not set')
  return uri
}

// ─── Types ────────────────────────────────────────────────────────────────────

export class GoogleOAuthError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'GoogleOAuthError'
  }
}

// ─── Service ──────────────────────────────────────────────────────────────────

export class GoogleOAuthService {
  private createOAuth2Client(): Auth.OAuth2Client {
    return new google.auth.OAuth2(clientId(), clientSecret(), redirectUri())
  }

  private signState(userId: string): string {
    const hmac = createHmac('sha256', jwtSecret())
    hmac.update(userId)
    const signature = hmac.digest('hex')
    return `${userId}:${signature}`
  }

  private verifyState(state: string): string {
    const parts = state.split(':')
    if (parts.length !== 2) throw new GoogleOAuthError('STATE_MISMATCH')

    const userId = parts[0]
    const providedSignature = parts[1]

    if (!userId || !providedSignature) throw new GoogleOAuthError('STATE_MISMATCH')

    const hmac = createHmac('sha256', jwtSecret())
    hmac.update(userId)
    const expectedSignature = hmac.digest('hex')

    // Both are hex strings, compare them directly after normalizing length
    if (
      providedSignature.length !== expectedSignature.length ||
      providedSignature !== expectedSignature
    ) {
      throw new GoogleOAuthError('STATE_MISMATCH')
    }

    return userId
  }

  buildAuthUrl(userId: string): string {
    const oauth2Client = this.createOAuth2Client()
    const state = this.signState(userId)

    return oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: 'https://www.googleapis.com/auth/drive.readonly',
      state,
    })
  }

  async exchangeCode(code: string, state: string): Promise<void> {
    const userId = this.verifyState(state)

    const oauth2Client = this.createOAuth2Client()
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.refresh_token) {
      throw new GoogleOAuthError('NO_REFRESH_TOKEN')
    }

    const tokenBuffer = Buffer.from(tokens.refresh_token, 'utf-8')

    await prisma.user.update({
      where: { id: userId },
      data: { googleRefreshToken: tokenBuffer },
    })

    logger.info({ userId }, 'Google OAuth token stored')
  }

  async isConnected(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    })

    return user?.googleRefreshToken != null
  }

  async getAuthorizedClient(userId: string): Promise<Auth.OAuth2Client> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { googleRefreshToken: true },
    })

    if (!user?.googleRefreshToken) {
      throw new GoogleOAuthError('NOT_CONNECTED')
    }

    const refreshToken = user.googleRefreshToken.toString('utf-8')
    const oauth2Client = this.createOAuth2Client()

    oauth2Client.setCredentials({
      refresh_token: refreshToken,
    })

    return oauth2Client
  }

  async disconnect(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { googleRefreshToken: null },
    })

    await prisma.auditLog.create({
      data: {
        userId,
        action: 'GOOGLE_OAUTH_DISCONNECT',
        tableName: 'users',
        recordId: userId,
        newValues: {},
      },
    })

    logger.info({ userId }, 'Google OAuth token disconnected')
  }
}
