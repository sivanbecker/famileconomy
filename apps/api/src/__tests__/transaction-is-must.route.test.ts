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
    isMust: null,
    description: Buffer.from('מסעדה'),
    amountAgorot: Buffer.from('5000'),
    ...overrides,
  }
}

// ─── PATCH /transactions/:id/is-must ─────────────────────────────────────────

describe('PATCH /transactions/:id/is-must', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTx() as never)
    vi.mocked(prisma.transaction.update).mockResolvedValue(makeTx({ isMust: false }) as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with isMust false when marking as nice-to-have', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ isMust: boolean | null }>()
    expect(body.isMust).toBe(false)
  })

  it('returns 200 with isMust null when resetting to must (default)', async () => {
    vi.mocked(prisma.transaction.update).mockResolvedValue(makeTx({ isMust: null }) as never)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: null },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ isMust: boolean | null }>()
    expect(body.isMust).toBeNull()
  })

  it('returns 200 with isMust true when explicitly marking as must', async () => {
    vi.mocked(prisma.transaction.update).mockResolvedValue(makeTx({ isMust: true }) as never)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: true },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ isMust: boolean | null }>()
    expect(body.isMust).toBe(true)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { isMust: false },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is not a UUID', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: 'not-a-uuid', isMust: false },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when isMust is a non-boolean string', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: 'yes' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when transaction does not exist', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: false },
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 403 when transaction belongs to a different user', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(
      makeTx({ account: { userId: 'other-user-id' } }) as never
    )
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: false },
    })
    expect(res.statusCode).toBe(403)
  })

  it('writes an audit log entry on success', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/is-must`,
      payload: { userId: USER_ID, isMust: false },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'UPDATE_IS_MUST',
          tableName: 'transactions',
          recordId: TX_ID,
          oldValues: { isMust: null },
          newValues: { isMust: false },
        }),
      })
    )
  })
})

// ─── PATCH /transactions/bulk-is-must ────────────────────────────────────────

describe('PATCH /transactions/bulk-is-must', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTx() as never,
      makeTx({ id: TX_ID_2 }) as never,
    ])
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with count of updated transactions', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [TX_ID, TX_ID_2], isMust: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ updated: number }>()
    expect(body.updated).toBe(2)
  })

  it('returns 200 for bulk reset to must (null)', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [TX_ID], isMust: null },
    })
    expect(res.statusCode).toBe(200)
  })

  it('returns 400 when ids array is empty', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [], isMust: false },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when ids array exceeds 500 items', async () => {
    const ids = Array.from({ length: 501 }, (_, i) => `${TX_ID.slice(0, -1)}${i % 10}`)
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids, isMust: false },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { ids: [TX_ID], isMust: false },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when isMust is an invalid value', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [TX_ID], isMust: 'yes' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('silently skips transactions that belong to a different user', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTx() as never])
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [TX_ID, TX_ID_2], isMust: false },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ updated: number }>()
    expect(body.updated).toBe(1)
  })

  it('returns 200 with updated: 0 when no owned transactions found', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([])
    const res = await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [TX_ID], isMust: false },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ updated: number }>().updated).toBe(0)
  })

  it('writes audit log entries for each updated transaction', async () => {
    await app.inject({
      method: 'PATCH',
      url: '/transactions/bulk-is-must',
      payload: { userId: USER_ID, ids: [TX_ID, TX_ID_2], isMust: false },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER_ID,
          action: 'UPDATE_IS_MUST',
          tableName: 'transactions',
        }),
      })
    )
  })
})
