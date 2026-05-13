import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

const TX_ID = 'aaaaaaaa-0000-0000-0000-000000000001'
const USER_ID = '00000000-0000-0000-0000-000000000099'
const NOTE_ID = 'bbbbbbbb-0000-0000-0000-000000000001'

function makeNote(overrides: Record<string, unknown> = {}) {
  return {
    id: NOTE_ID,
    transactionId: TX_ID,
    body: 'הערה לדוגמה',
    createdAt: new Date('2026-05-13T10:00:00Z'),
    updatedAt: new Date('2026-05-13T10:00:00Z'),
    ...overrides,
  }
}

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    accountId: '00000000-0000-0000-0000-000000000001',
    account: { userId: USER_ID },
    ...overrides,
  }
}

// ─── POST /transactions/:id/notes ─────────────────────────────────────────────

describe('POST /transactions/:id/notes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTx() as never)
    vi.mocked(prisma.transactionNote.create).mockResolvedValue(makeNote() as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 201 with the created note', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { userId: USER_ID, body: 'הערה לדוגמה' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ note: { id: string; body: string } }>()
    expect(body.note.body).toBe('הערה לדוגמה')
  })

  it('returns 400 when body is empty', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { userId: USER_ID, body: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when body exceeds 2000 chars', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { userId: USER_ID, body: 'א'.repeat(2001) },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { body: 'הערה' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when transaction does not exist', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { userId: USER_ID, body: 'הערה' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when transaction belongs to a different user', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(
      makeTx({ account: { userId: 'other-user-id' } }) as never
    )
    const res = await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { userId: USER_ID, body: 'הערה' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('writes an audit log entry on success', async () => {
    await app.inject({
      method: 'POST',
      url: `/transactions/${TX_ID}/notes`,
      payload: { userId: USER_ID, body: 'הערה לדוגמה' },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'CREATE_NOTE',
          tableName: 'transaction_notes',
          recordId: TX_ID,
        }),
      })
    )
  })
})

// ─── GET /transactions/:id/notes ──────────────────────────────────────────────

describe('GET /transactions/:id/notes', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTx() as never)
    vi.mocked(prisma.transactionNote.findMany).mockResolvedValue([makeNote()] as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with list of notes', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/${TX_ID}/notes?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ notes: unknown[] }>()
    expect(body.notes).toHaveLength(1)
  })

  it('returns 404 when transaction does not exist', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/${TX_ID}/notes?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when transaction belongs to a different user', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(
      makeTx({ account: { userId: 'other-user-id' } }) as never
    )
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/${TX_ID}/notes?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/${TX_ID}/notes`,
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── DELETE /transactions/:id/notes/:noteId ───────────────────────────────────

describe('DELETE /transactions/:id/notes/:noteId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTx() as never)
    vi.mocked(prisma.transactionNote.findFirst).mockResolvedValue(makeNote() as never)
    vi.mocked(prisma.transactionNote.delete).mockResolvedValue(makeNote() as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 204 on successful delete', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(204)
  })

  it('returns 404 when note does not exist', async () => {
    vi.mocked(prisma.transactionNote.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'DELETE',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when transaction belongs to a different user', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(
      makeTx({ account: { userId: 'other-user-id' } }) as never
    )
    const res = await app.inject({
      method: 'DELETE',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(403)
  })

  it('writes an audit log entry on success', async () => {
    await app.inject({
      method: 'DELETE',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}?userId=${USER_ID}`,
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'DELETE_NOTE',
          tableName: 'transaction_notes',
          recordId: TX_ID,
        }),
      })
    )
  })
})

// ─── PATCH /transactions/:id/notes/:noteId ────────────────────────────────────

describe('PATCH /transactions/:id/notes/:noteId', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTx() as never)
    vi.mocked(prisma.transactionNote.findFirst).mockResolvedValue(makeNote() as never)
    vi.mocked(prisma.transactionNote.update).mockResolvedValue(
      makeNote({ body: 'הערה מעודכנת' }) as never
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with updated note', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}`,
      payload: { userId: USER_ID, body: 'הערה מעודכנת' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ note: { body: string } }>()
    expect(body.note.body).toBe('הערה מעודכנת')
  })

  it('returns 400 when body is empty', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}`,
      payload: { userId: USER_ID, body: '' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when note does not exist', async () => {
    vi.mocked(prisma.transactionNote.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}`,
      payload: { userId: USER_ID, body: 'מעודכן' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when transaction belongs to a different user', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(
      makeTx({ account: { userId: 'other-user-id' } }) as never
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}`,
      payload: { userId: USER_ID, body: 'מעודכן' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('writes an audit log entry on success', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/notes/${NOTE_ID}`,
      payload: { userId: USER_ID, body: 'הערה מעודכנת' },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'UPDATE_NOTE',
          tableName: 'transaction_notes',
          recordId: TX_ID,
        }),
      })
    )
  })
})
