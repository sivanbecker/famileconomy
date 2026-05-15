import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'
const TX_ID = '00000000-0000-0000-0000-000000000010'
const USER_ID = '00000000-0000-0000-0000-000000000099'

function makeTxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TX_ID,
    transactionDate: new Date('2026-05-10'),
    description: Buffer.from('סופרמרקט'),
    amountAgorot: Buffer.from('5000'),
    category: 'מזון',
    cardLastFour: '1234',
    status: 'CLEARED',
    reviewStatus: null,
    installmentNum: null,
    installmentOf: null,
    chargeDate: null,
    isMust: null,
    notes: null,
    ...overrides,
  }
}

// ─── GET /transactions — filters ──────────────────────────────────────────────

describe('GET /transactions — search filter', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns only matching transactions when search term is provided', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ description: Buffer.from('סופרמרקט שופרסל') }),
      makeTxRow({ id: 'tx-2', description: Buffer.from('דלק') }),
    ] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&search=סופר`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { description: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.description).toContain('סופר')
  })

  it('returns all transactions when search is not provided', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ description: Buffer.from('סופרמרקט') }),
      makeTxRow({ id: 'tx-2', description: Buffer.from('דלק') }),
    ] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ transactions: unknown[] }>().transactions).toHaveLength(2)
  })
})

describe('GET /transactions — category filter', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxRow()] as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('passes category as exact match filter', async () => {
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&category=מזון`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ category: 'מזון' })
  })

  it('omits category filter when not provided', async () => {
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.where).not.toHaveProperty('category')
  })
})

describe('GET /transactions — amount range filter', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when minAmount is not a number', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&minAmount=abc`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when maxAmount is negative', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&maxAmount=-1`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when minAmount exceeds maxAmount', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&minAmount=10000&maxAmount=5000`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('filters out transactions below minAmount', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-cheap', amountAgorot: Buffer.from('500') }),
      makeTxRow({ id: 'tx-expensive', amountAgorot: Buffer.from('5000') }),
    ] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&minAmount=1000`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.id).toBe('tx-expensive')
  })

  it('filters out transactions above maxAmount', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-cheap', amountAgorot: Buffer.from('500') }),
      makeTxRow({ id: 'tx-expensive', amountAgorot: Buffer.from('5000') }),
    ] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&maxAmount=1000`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.id).toBe('tx-cheap')
  })
})

describe('GET /transactions — sort order', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxRow()] as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('sorts by date desc by default', async () => {
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.orderBy).toMatchObject({ transactionDate: 'desc' })
  })

  it('sorts by amount asc in response when sortBy=amount&sortDir=asc', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-big', amountAgorot: Buffer.from('9000') }),
      makeTxRow({ id: 'tx-small', amountAgorot: Buffer.from('1000') }),
    ] as never)
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&sortBy=amount&sortDir=asc`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions[0]?.id).toBe('tx-small')
    expect(body.transactions[1]?.id).toBe('tx-big')
  })

  it('accepts sortBy=category', async () => {
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&sortBy=category`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.orderBy).toMatchObject({ category: 'desc' })
  })

  it('returns 400 for invalid sortBy value', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&sortBy=invalid`,
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── GET /transactions — isMust filter ───────────────────────────────────────

describe('GET /transactions — isMust filter', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('passes isMust=true as DB-level filter (exact true)', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxRow({ isMust: true })] as never)
    app = await buildApp()
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&isMust=true`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ isMust: true })
  })

  it('passes isMust=false as DB-level filter excluding true (covers null)', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ isMust: false }),
    ] as never)
    app = await buildApp()
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&isMust=false`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ isMust: { not: true } })
  })

  it('omits isMust filter when not provided', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxRow()] as never)
    app = await buildApp()
    await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.where).not.toHaveProperty('isMust')
  })

  it('returns 400 when isMust has an invalid value', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5&isMust=maybe`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('includes isMust field in each transaction row of the response', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ isMust: false }),
    ] as never)
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/transactions?accountId=${ACCOUNT_ID}&year=2026&month=5`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { isMust: boolean | null }[] }>()
    expect(body.transactions[0]).toHaveProperty('isMust', false)
  })
})

// ─── PATCH /transactions/:id/category ─────────────────────────────────────────

describe('PATCH /transactions/:id/category', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(makeTxRow() as never)
    vi.mocked(prisma.transaction.update).mockResolvedValue(
      makeTxRow({ category: 'תחבורה' }) as never
    )
    vi.mocked(prisma.auditLog.create).mockResolvedValue({} as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 200 and updated category', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/category`,
      payload: { category: 'תחבורה', userId: USER_ID },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ category: 'תחבורה' })
  })

  it('writes an audit log entry on category change', async () => {
    await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/category`,
      payload: { category: 'תחבורה', userId: USER_ID },
    })
    expect(vi.mocked(prisma.auditLog.create)).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATE_CATEGORY',
          tableName: 'transactions',
          recordId: TX_ID,
          userId: USER_ID,
        }),
      })
    )
  })

  it('returns 400 when category is empty string', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/category`,
      payload: { category: '', userId: USER_ID },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/category`,
      payload: { category: 'מזון' },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when transaction does not exist', async () => {
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/category`,
      payload: { category: 'מזון', userId: USER_ID },
    })
    expect(res.statusCode).toBe(404)
  })

  it('allows clearing a category by passing null', async () => {
    vi.mocked(prisma.transaction.update).mockResolvedValue(makeTxRow({ category: null }) as never)
    const res = await app.inject({
      method: 'PATCH',
      url: `/transactions/${TX_ID}/category`,
      payload: { category: null, userId: USER_ID },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ category: null })
  })
})
