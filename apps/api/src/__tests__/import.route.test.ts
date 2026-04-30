import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { ImportService, ImportError } from '../services/import.service.js'

// ─── Mock ImportService ───────────────────────────────────────────────────────

vi.mock('../services/import.service.js', () => {
  class ImportError extends Error {
    constructor(public readonly code: string) {
      super(code)
      this.name = 'ImportError'
    }
  }
  const ImportService = vi.fn().mockImplementation(() => ({
    importCsv: vi.fn(),
  }))
  return { ImportService, ImportError }
})

type MockImportServiceShape = { importCsv: ReturnType<typeof vi.fn> }

function getMockService(): MockImportServiceShape {
  return vi.mocked(ImportService).mock.results[0]?.value as MockImportServiceShape
}

// ─── Multipart helper ─────────────────────────────────────────────────────────

function makeMultipartBody(
  fields: Record<string, string>,
  file: { name: string; content: string }
): { body: Buffer; boundary: string } {
  const boundary = '----TestBoundary12345'
  const parts: string[] = []

  for (const [key, value] of Object.entries(fields)) {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}`)
  }

  parts.push(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: text/csv\r\n\r\n${file.content}`
  )

  const body = Buffer.from(parts.join('\r\n') + `\r\n--${boundary}--\r\n`, 'utf-8')
  return { body, boundary }
}

const DUMMY_CSV = 'date,amount\n2026-04-09,17'
const USER_ID = 'user-uuid-1'
const SUCCESS_RESULT = { inserted: 3, duplicates: 1, errors: [] }

// ─── App factory ──────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('POST /import/csv', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(ImportService).mockClear()
    vi.mocked(ImportService).mockImplementation(
      () => ({ importCsv: vi.fn().mockResolvedValue(SUCCESS_RESULT) }) as never
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
  })

  it('returns 200 with inserted/duplicates counts on success', async () => {
    const { body, boundary } = makeMultipartBody(
      { provider: 'MAX', userId: USER_ID },
      { name: 'max.csv', content: DUMMY_CSV }
    )
    const res = await app.inject({
      method: 'POST',
      url: '/import/csv',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    expect(res.statusCode).toBe(200)
    const json = res.json<{ inserted: number; duplicates: number; errors: unknown[] }>()
    expect(json.inserted).toBe(3)
    expect(json.duplicates).toBe(1)
    expect(json.errors).toEqual([])
  })

  it('passes the file content, provider, userId, and filename to the service', async () => {
    const { body, boundary } = makeMultipartBody(
      { provider: 'MAX', userId: USER_ID },
      { name: 'max.csv', content: DUMMY_CSV }
    )
    await app.inject({
      method: 'POST',
      url: '/import/csv',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    const svc = getMockService()
    expect(svc.importCsv).toHaveBeenCalledWith(
      expect.objectContaining({
        csv: DUMMY_CSV,
        filename: 'max.csv',
        provider: 'MAX',
        userId: USER_ID,
      })
    )
  })

  it('returns 400 when provider field is missing', async () => {
    const { body, boundary } = makeMultipartBody(
      { userId: USER_ID },
      { name: 'max.csv', content: DUMMY_CSV }
    )
    const res = await app.inject({
      method: 'POST',
      url: '/import/csv',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when file field is missing', async () => {
    const boundary = '----TestBoundary12345'
    const rawBody =
      `--${boundary}\r\nContent-Disposition: form-data; name="provider"\r\n\r\nMAX\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="userId"\r\n\r\n${USER_ID}\r\n` +
      `--${boundary}--\r\n`
    const res = await app.inject({
      method: 'POST',
      url: '/import/csv',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body: Buffer.from(rawBody, 'utf-8'),
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 409 with message when service throws FILE_ALREADY_IMPORTED', async () => {
    vi.mocked(ImportService).mockClear()
    vi.mocked(ImportService).mockImplementation(
      () =>
        ({
          importCsv: vi.fn().mockRejectedValue(new ImportError('FILE_ALREADY_IMPORTED')),
        }) as never
    )
    const localApp = await buildApp()
    const { body, boundary } = makeMultipartBody(
      { provider: 'MAX', userId: USER_ID },
      { name: 'max.csv', content: DUMMY_CSV }
    )
    const res = await localApp.inject({
      method: 'POST',
      url: '/import/csv',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    await localApp.close()
    expect(res.statusCode).toBe(409)
    expect(res.json<{ message: string }>().message).toBe('You already imported this file!')
  })

  it('returns 422 when service throws FORMAT_MISMATCH', async () => {
    vi.mocked(ImportService).mockClear()
    vi.mocked(ImportService).mockImplementation(
      () =>
        ({
          importCsv: vi.fn().mockRejectedValue(new ImportError('FORMAT_MISMATCH')),
        }) as never
    )
    const localApp = await buildApp()
    const { body, boundary } = makeMultipartBody(
      { provider: 'MAX', userId: USER_ID },
      { name: 'bad.csv', content: DUMMY_CSV }
    )
    const res = await localApp.inject({
      method: 'POST',
      url: '/import/csv',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      body,
    })
    await localApp.close()
    expect(res.statusCode).toBe(422)
  })
})
