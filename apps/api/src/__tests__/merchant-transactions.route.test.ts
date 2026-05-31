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
    transactionDate: new Date('2026-03-15'),
    chargeDate: null,
    description: Buffer.from('סופרמרקט שופרסל'),
    amountAgorot: Buffer.from('8500'),
    category: 'מזון ומשקאות',
    cardLastFour: '1234',
    status: 'CLEARED',
    reviewStatus: null,
    installmentNum: null,
    installmentOf: null,
    notes: null,
    isMust: null,
    ...overrides,
  }
}

// ─── GET /transactions/by-merchant — validation ───────────────────────────────

describe('GET /transactions/by-merchant — validation', () => {
  let app: FastifyInstance

  beforeEach(async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([makeTxRow()] as never)
    app = await buildApp()
  })

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when userId is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions/by-merchant?merchant=%D7%A1%D7%95%D7%A4%D7%A8',
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when merchant is missing', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when userId is not a UUID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/transactions/by-merchant?userId=not-a-uuid&merchant=foo',
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 200 with valid userId and merchant', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט שופרסל')}`,
    })
    expect(res.statusCode).toBe(200)
  })
})

// ─── GET /transactions/by-merchant — merchant matching ───────────────────────

describe('GET /transactions/by-merchant — merchant matching', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns only transactions whose description matches the merchant (exact, case-insensitive)', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-1', description: Buffer.from('סופרמרקט שופרסל') }),
      makeTxRow({ id: 'tx-2', description: Buffer.from('דלק גלילות') }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט שופרסל')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.id).toBe('tx-1')
  })

  it('returns empty list when no transactions match the merchant', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ description: Buffer.from('דלק גלילות') }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט')}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ transactions: unknown[] }>().transactions).toHaveLength(0)
  })

  it('returns empty list when user has no accounts', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([])
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט')}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ transactions: unknown[] }>().transactions).toHaveLength(0)
  })

  it('queries transactions across all user accounts', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([
      { id: ACCOUNT_ID },
      { id: ACCOUNT_ID_2 },
    ] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-a1', description: Buffer.from('סופרמרקט שופרסל') }),
      makeTxRow({ id: 'tx-a2', description: Buffer.from('סופרמרקט שופרסל') }),
    ] as never)
    app = await buildApp()

    await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט שופרסל')}`,
    })
    const call = vi.mocked(prisma.transaction.findMany).mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({
      accountId: { in: [ACCOUNT_ID, ACCOUNT_ID_2] },
    })
  })
})

// ─── GET /transactions/by-merchant — year filter ─────────────────────────────

describe('GET /transactions/by-merchant — year filter', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('applies year filter when provided', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-2026',
        transactionDate: new Date('2026-03-15'),
        description: Buffer.from('סופרמרקט שופרסל'),
      }),
      makeTxRow({
        id: 'tx-2025',
        transactionDate: new Date('2025-11-10'),
        description: Buffer.from('סופרמרקט שופרסל'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט שופרסל')}&year=2026`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.id).toBe('tx-2026')
  })

  it('returns all years when year is not provided', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-2026',
        transactionDate: new Date('2026-03-15'),
        description: Buffer.from('סופרמרקט שופרסל'),
      }),
      makeTxRow({
        id: 'tx-2025',
        transactionDate: new Date('2025-11-10'),
        description: Buffer.from('סופרמרקט שופרסל'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט שופרסל')}`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json<{ transactions: unknown[] }>().transactions).toHaveLength(2)
  })

  it('returns 400 when year is out of range', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=foo&year=1999`,
    })
    expect(res.statusCode).toBe(400)
  })
})

// ─── GET /transactions/by-merchant — summary ─────────────────────────────────

describe('GET /transactions/by-merchant — summary', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns summary with totalAgorot, count, firstSeen, lastSeen', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-1',
        transactionDate: new Date('2026-01-10'),
        amountAgorot: Buffer.from('5000'),
        description: Buffer.from('סופרמרקט שופרסל'),
      }),
      makeTxRow({
        id: 'tx-2',
        transactionDate: new Date('2026-03-20'),
        amountAgorot: Buffer.from('8500'),
        description: Buffer.from('סופרמרקט שופרסל'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט שופרסל')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{
      summary: {
        totalAgorot: number
        count: number
        firstSeen: string
        lastSeen: string
        avgMonthlyAgorot: number
      }
    }>()
    expect(body.summary.totalAgorot).toBe(13500)
    expect(body.summary.count).toBe(2)
    expect(body.summary.firstSeen).toBe('2026-01-10')
    expect(body.summary.lastSeen).toBe('2026-03-20')
  })

  it('returns zero summary when no matching transactions', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ description: Buffer.from('דלק') }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('סופרמרקט')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ summary: { totalAgorot: number; count: number } }>()
    expect(body.summary.totalAgorot).toBe(0)
    expect(body.summary.count).toBe(0)
  })

  it('returns avgMonthlyAgorot as totalAgorot / number-of-distinct-months', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    // Two transactions: both in January 2026 — same month, so avg = total / 1
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-1',
        transactionDate: new Date('2026-01-05'),
        amountAgorot: Buffer.from('5000'),
        description: Buffer.from('מרכול'),
      }),
      makeTxRow({
        id: 'tx-2',
        transactionDate: new Date('2026-01-20'),
        amountAgorot: Buffer.from('3000'),
        description: Buffer.from('מרכול'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('מרכול')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ summary: { avgMonthlyAgorot: number } }>()
    // 8000 agorot across 1 distinct month
    expect(body.summary.avgMonthlyAgorot).toBe(8000)
  })

  it('avgMonthlyAgorot spans two distinct months', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-1',
        transactionDate: new Date('2026-01-05'),
        amountAgorot: Buffer.from('6000'),
        description: Buffer.from('מרכול'),
      }),
      makeTxRow({
        id: 'tx-2',
        transactionDate: new Date('2026-02-10'),
        amountAgorot: Buffer.from('4000'),
        description: Buffer.from('מרכול'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('מרכול')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ summary: { avgMonthlyAgorot: number } }>()
    // 10000 agorot across 2 distinct months = 5000
    expect(body.summary.avgMonthlyAgorot).toBe(5000)
  })
})

// ─── GET /transactions/by-merchant — isMust filter ───────────────────────────

describe('GET /transactions/by-merchant — isMust filter', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('filters to isMust=true transactions when isMust param is true', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-must', isMust: true, description: Buffer.from('ביטוח') }),
      makeTxRow({ id: 'tx-not', isMust: false, description: Buffer.from('ביטוח') }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/transactions/by-merchant?userId=${USER_ID}&merchant=${encodeURIComponent('ביטוח')}&isMust=true`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.id).toBe('tx-must')
  })
})
