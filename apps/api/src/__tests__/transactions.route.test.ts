import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'
const ACCOUNT_ID_2 = '00000000-0000-0000-0000-000000000002'
const USER_ID = '00000000-0000-0000-0000-000000000099'

function makeTxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    transactionDate: new Date('2026-05-10'),
    description: Buffer.from('קפה'),
    amountAgorot: Buffer.from('1500'),
    category: 'מזון',
    cardLastFour: '5432',
    status: 'CLEARED',
    reviewStatus: null,
    installmentNum: null,
    installmentOf: null,
    chargeDate: null,
    ...overrides,
  }
}

// ─── GET /transactions — single account ───────────────────────────────────────

describe('GET /transactions — single account', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxRow()] as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with transactions for a valid accountId', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: unknown[] }>()
    expect(body.transactions).toHaveLength(1)
  })

  it('returns 400 when accountId is not a UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions?accountId=not-a-uuid&year=2026&month=5',
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when year is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&month=5`,
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── GET /transactions — all accounts ─────────────────────────────────────────

describe('GET /transactions — all accounts (userId, no accountId)', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      { id: ACCOUNT_ID } as never,
      { id: ACCOUNT_ID_2 } as never,
    ])
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-1', cardLastFour: '5432' }),
      makeTxRow({ id: 'tx-2', cardLastFour: '0017' }),
    ] as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 with transactions from all user accounts', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?userId=${USER_ID}&year=2026&month=5`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: unknown[] }>()
    expect(body.transactions).toHaveLength(2)
  })

  it('looks up accounts by userId before querying transactions', async () => {
    await app.inject({
      method: 'GET',
      url: `/transactions?userId=${USER_ID}&year=2026&month=5`,
    })
    expect(vi.mocked(prisma.account.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: USER_ID } })
    )
  })

  it('queries transactions with all account IDs in scope', async () => {
    await app.inject({
      method: 'GET',
      url: `/transactions?userId=${USER_ID}&year=2026&month=5`,
    })
    expect(vi.mocked(prisma.transaction.findMany)).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          accountId: { in: [ACCOUNT_ID, ACCOUNT_ID_2] },
        }),
      })
    )
  })

  it('returns empty list when user has no accounts', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([])
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?userId=${USER_ID}&year=2026&month=5`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ transactions: unknown[] }>().transactions).toHaveLength(0)
  })

  it('returns 400 when neither accountId nor userId is provided', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions?year=2026&month=5',
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is not a UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions?userId=not-a-uuid&year=2026&month=5',
    })
    expect(res.statusCode).toBe(400)
  })
})
