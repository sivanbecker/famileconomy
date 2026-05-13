import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

const TX_ID = 'aaaaaaaa-1111-0000-0000-000000000001'
const TX_ID_2 = 'aaaaaaaa-2222-0000-0000-000000000002'
const USER_ID = '00000000-0000-0000-0000-000000000099'
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'

function makeTx(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    accountId: ACCOUNT_ID,
    account: { userId: USER_ID },
    reviewStatus: null,
    description: Buffer.from('מסעדה'),
    amountAgorot: Buffer.from('5000'),
    ...overrides,
  }
}

// ─── PATCH /transactions/:id/review ──────────────────────────────────────────

describe('PATCH /transactions/:id/review', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTx() as never)
    vi.mocked(prisma.transaction.update).mockResolvedValue(
      makeTx({ reviewStatus: 'USER_REVIEWED' }) as never
    )
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with updated reviewStatus USER_REVIEWED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ reviewStatus: string | null }>()
    expect(body.reviewStatus).toBe('USER_REVIEWED')
  })

  it('returns 200 with updated reviewStatus USER_FLAGGED', async () => {
    vi.mocked(prisma.transaction.update).mockResolvedValue(
      makeTx({ reviewStatus: 'USER_FLAGGED' }) as never
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: 'USER_FLAGGED' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ reviewStatus: string | null }>()
    expect(body.reviewStatus).toBe('USER_FLAGGED')
  })

  it('returns 200 with null reviewStatus (clear review)', async () => {
    vi.mocked(prisma.transaction.update).mockResolvedValue(makeTx({ reviewStatus: null }) as never)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: null },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ reviewStatus: string | null }>()
    expect(body.reviewStatus).toBeNull()
  })

  it('returns 400 when reviewStatus is an invalid value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: 'INVALID_STATUS' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is not a UUID', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: 'not-a-uuid', reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when transaction does not exist', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when transaction belongs to a different user', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(
      makeTx({ account: { userId: 'other-user-id' } }) as never
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(403)
  })

  it('writes an audit log entry on success', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/review`,
      payload: { userId: USER_ID, reviewStatus: 'USER_REVIEWED' },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'UPDATE_REVIEW_STATUS',
          tableName: 'transactions',
          recordId: TX_ID,
          newValues: { reviewStatus: 'USER_REVIEWED' },
        }),
      })
    )
  })
})

// ─── PATCH /transactions/bulk-review ─────────────────────────────────────────

describe('PATCH /transactions/bulk-review', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID } as never])
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTx() as never,
      makeTx({ id: TX_ID_2 }) as never,
    ])
    // $transaction mock calls each prisma op
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with count of updated transactions', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [TX_ID, TX_ID_2], reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ updated: number }>()
    expect(body.updated).toBe(2)
  })

  it('returns 200 for bulk USER_FLAGGED', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [TX_ID], reviewStatus: 'USER_FLAGGED' },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 200 for bulk clear (null)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [TX_ID], reviewStatus: null },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 when ids array is empty', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [], reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when ids array exceeds 500 items', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `${TX_ID.slice(0, -1)}${i % 10}`)
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids, reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { ids: [TX_ID], reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when reviewStatus is invalid', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [TX_ID], reviewStatus: 'WRONG' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('silently skips transactions that belong to a different user', async () => {
    // Only one tx belongs to this user
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTx() as never])
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [TX_ID, TX_ID_2], reviewStatus: 'USER_REVIEWED' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ updated: number }>()
    expect(body.updated).toBe(1)
  })

  it('writes audit log entries for each updated transaction', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-review',
      payload: { userId: USER_ID, ids: [TX_ID, TX_ID_2], reviewStatus: 'USER_REVIEWED' },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'UPDATE_REVIEW_STATUS',
          tableName: 'transactions',
        }),
      })
    )
  })
})
