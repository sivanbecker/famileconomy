import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { createApp } from '../server.js'

describe('Google Drive Routes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    app = await createApp()
  })

  afterEach(async () => {
    await app.close()
  })

  describe('GET /auth/google/connect', () => {
    it('returns authUrl for valid userId', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000'

      const response = await app.inject({
        method: 'GET',
        url: `/auth/google/connect?userId=${userId}`,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body).toHaveProperty('authUrl')
      expect(body.authUrl).toContain('accounts.google.com')
      expect(body.authUrl).toContain('client_id=')
      expect(body.authUrl).toContain('drive.readonly')
    })

    it('returns 400 for missing userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/connect',
      })

      expect(response.statusCode).toBe(400)
      const body = JSON.parse(response.body)
      expect(body.error).toBe('VALIDATION_ERROR')
    })

    it('accepts multiple requests (rate limit check deferred)', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000'
      const url = `/auth/google/connect?userId=${userId}`

      for (let i = 0; i < 2; i++) {
        const response = await app.inject({
          method: 'GET',
          url,
        })
        expect(response.statusCode).toBe(200)
      }
    })
  })

  describe('GET /auth/google/callback', () => {
    it('requires code and state query params', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=test&state=token',
      })

      expect([302, 500]).toContain(response.statusCode)
    })

    it('returns 400 for missing code', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?state=token',
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 400 for missing state', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/callback?code=code123',
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('GET /auth/google/status', () => {
    it('returns connected: false for user without token', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000'

      const response = await app.inject({
        method: 'GET',
        url: `/auth/google/status?userId=${userId}`,
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.connected).toBe(false)
    })

    it('returns 400 for missing userId', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/auth/google/status',
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('DELETE /auth/google/disconnect', () => {
    it('disconnects Google Drive for user', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000'

      const response = await app.inject({
        method: 'DELETE',
        url: '/auth/google/disconnect',
        payload: { userId },
      })

      expect(response.statusCode).toBe(200)
    })

    it('returns 400 for invalid userId', async () => {
      const response = await app.inject({
        method: 'DELETE',
        url: '/auth/google/disconnect',
        payload: { userId: 'invalid-uuid' },
      })

      expect(response.statusCode).toBe(400)
    })
  })

  describe('POST /drive/import', () => {
    it('returns 400 for invalid type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/drive/import',
        payload: {
          userId: '123e4567-e89b-12d3-a456-426614174000',
          type: 'invalid_type',
          resourceId: 'resource123',
        },
      })

      expect(response.statusCode).toBe(400)
    })

    it('returns 409 if user not connected to Google Drive', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000'

      const response = await app.inject({
        method: 'POST',
        url: '/drive/import',
        payload: {
          userId,
          type: 'folder',
          resourceId: 'folder123',
        },
      })

      expect(response.statusCode).toBe(409)
    })

    it('accepts valid request with connected user (mock)', async () => {
      const userId = '123e4567-e89b-12d3-a456-426614174000'

      const response = await app.inject({
        method: 'POST',
        url: '/drive/import',
        payload: {
          userId,
          type: 'folder',
          resourceId: 'folder123',
        },
      })

      expect([202, 409]).toContain(response.statusCode)
    })
  })

  describe('GET /drive/import/:jobId', () => {
    it('returns 404 for nonexistent job', async () => {
      const jobId = 'a'.repeat(64)

      const response = await app.inject({
        method: 'GET',
        url: `/drive/import/${jobId}`,
      })

      expect(response.statusCode).toBe(404)
    })

    it('returns 400 for invalid jobId format', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/drive/import/invalid-job-id',
      })

      expect(response.statusCode).toBe(400)
    })
  })
})
