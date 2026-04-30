import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { prisma } from '../db/prisma.js'
import type { Auth } from 'googleapis'
import type { User, AuditLog } from '@prisma/client'

const mockGenerateAuthUrl = vi.fn()
const mockGetToken = vi.fn()
const mockSetCredentials = vi.fn()

vi.mock('googleapis', () => ({
  google: {
    auth: {
      OAuth2: vi.fn(() => ({
        generateAuthUrl: mockGenerateAuthUrl,
        getToken: mockGetToken,
        setCredentials: mockSetCredentials,
      })),
    },
  },
}))

// Import after mocking
import { GoogleOAuthService } from '../services/google-oauth.service.js'

function jwtSecret(): string {
  return process.env['JWT_SECRET'] || 'test-secret-key'
}

function signState(userId: string): string {
  const hmac = createHmac('sha256', jwtSecret())
  hmac.update(userId)
  const signature = hmac.digest('hex')
  return `${userId}:${signature}`
}

describe('GoogleOAuthService', () => {
  let service: GoogleOAuthService

  beforeEach(() => {
    vi.clearAllMocks()
    mockSetCredentials.mockReturnValue(undefined)
    mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth')
    service = new GoogleOAuthService()
  })

  describe('buildAuthUrl', () => {
    it('returns a URL with correct OAuth parameters', () => {
      mockGenerateAuthUrl.mockReturnValue(
        'https://accounts.google.com/o/oauth2/v2/auth?client_id=...'
      )

      const userId = 'user-123'
      const result = service.buildAuthUrl(userId)

      expect(result).toContain('accounts.google.com')
      expect(mockGenerateAuthUrl).toHaveBeenCalled()
    })

    it('includes the user-signed state parameter', () => {
      mockGenerateAuthUrl.mockReturnValue('https://accounts.google.com/o/oauth2/v2/auth?state=...')

      const userId = 'user-456'
      service.buildAuthUrl(userId)

      expect(mockGenerateAuthUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          access_type: 'offline',
          scope: 'https://www.googleapis.com/auth/drive.readonly',
          state: expect.stringContaining(userId),
        })
      )
    })
  })

  describe('exchangeCode', () => {
    it('stores encrypted refresh token via prisma.user.update', async () => {
      const userId = 'user-789'
      const code = 'auth-code-xyz'
      const state = signState(userId)

      const mockToken = { refresh_token: 'refresh-token-value' }
      mockGetToken.mockResolvedValue({ tokens: mockToken })
      const mockUser: Partial<User> = { id: userId }
      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as User)

      await service.exchangeCode(code, state)

      expect(mockGetToken).toHaveBeenCalledWith(code)
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: userId },
          data: { googleRefreshToken: expect.any(Buffer) },
        })
      )
    })

    it('throws GoogleOAuthError(STATE_MISMATCH) when state is invalid', async () => {
      const code = 'auth-code-xyz'
      const badState = 'bad-state:invalid-hmac'

      await expect(service.exchangeCode(code, badState)).rejects.toMatchObject({
        code: 'STATE_MISMATCH',
      })
    })

    it('throws GoogleOAuthError(STATE_MISMATCH) when state format is wrong', async () => {
      const code = 'auth-code-xyz'
      const badState = 'no-colon-here'

      await expect(service.exchangeCode(code, badState)).rejects.toMatchObject({
        code: 'STATE_MISMATCH',
      })
    })
  })

  describe('isConnected', () => {
    it('returns true when user has googleRefreshToken', async () => {
      const userId = 'user-111'
      const mockUser: Partial<User> = {
        id: userId,
        googleRefreshToken: Buffer.from('token-data'),
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as User)

      const result = await service.isConnected(userId)

      expect(result).toBe(true)
    })

    it('returns false when googleRefreshToken is null', async () => {
      const userId = 'user-222'
      const mockUser: Partial<User> = {
        id: userId,
        googleRefreshToken: null,
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as User)

      const result = await service.isConnected(userId)

      expect(result).toBe(false)
    })

    it('returns false when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const result = await service.isConnected('nonexistent-user')

      expect(result).toBe(false)
    })
  })

  describe('getAuthorizedClient', () => {
    it('returns an OAuth2Client when token exists', async () => {
      const tokenData = Buffer.from('encrypted-token')
      const mockUser: Partial<User> = {
        id: 'user-333',
        googleRefreshToken: tokenData,
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as User)

      const client: Auth.OAuth2Client = await service.getAuthorizedClient('user-333')

      expect(client).toBeDefined()
      expect(mockGetToken).not.toHaveBeenCalled()
    })

    it('throws GoogleOAuthError(NOT_CONNECTED) when token is null', async () => {
      const userId = 'user-444'
      const mockUser: Partial<User> = {
        id: userId,
        googleRefreshToken: null,
      }
      vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser as User)

      await expect(service.getAuthorizedClient(userId)).rejects.toMatchObject({
        code: 'NOT_CONNECTED',
      })
    })

    it('throws GoogleOAuthError(NOT_CONNECTED) when user not found', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      await expect(service.getAuthorizedClient('nonexistent-user')).rejects.toMatchObject({
        code: 'NOT_CONNECTED',
      })
    })
  })

  describe('disconnect', () => {
    it('nullifies googleRefreshToken and writes audit log', async () => {
      const userId = 'user-555'
      const mockUser: Partial<User> = { id: userId }
      const mockAudit: Partial<AuditLog> = { id: 'log-1' }

      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as User)
      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAudit as AuditLog)

      await service.disconnect(userId)

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { googleRefreshToken: null },
      })

      expect(prisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId,
            action: 'GOOGLE_OAUTH_DISCONNECT',
            tableName: 'users',
            recordId: userId,
          }),
        })
      )
    })

    it('returns successfully on disconnect', async () => {
      const userId = 'user-666'
      const mockUser: Partial<User> = { id: userId }
      const mockAudit: Partial<AuditLog> = { id: 'log-2' }

      vi.mocked(prisma.user.update).mockResolvedValue(mockUser as User)
      vi.mocked(prisma.auditLog.create).mockResolvedValue(mockAudit as AuditLog)

      await expect(service.disconnect(userId)).resolves.toBeUndefined()
    })
  })
})
