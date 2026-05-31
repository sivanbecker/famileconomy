import { describe, it, expect, vi, afterEach } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { prisma } from '../db/prisma.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function buildApp(): Promise<FastifyInstance> {
  const { createApp } = await import('../server.js')
  return createApp()
}

const USER_ID = '00000000-0000-0000-0000-000000000099'
const USER_ID_OTHER = '00000000-0000-0000-0000-000000000098'
const BUCKET_ID = '11111111-1111-1111-1111-111111111111'
const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'

function makeBucket(overrides: Record<string, unknown> = {}) {
  return {
    id: BUCKET_ID,
    userId: USER_ID,
    name: 'ביטוח רכב',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    descriptions: [
      { bucketId: BUCKET_ID, description: "איי אי ג'י-ביטוח רכב", addedAt: new Date('2026-01-01') },
    ],
    ...overrides,
  }
}

function makeTxRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tx-1',
    transactionDate: new Date('2026-03-15'),
    description: Buffer.from("איי אי ג'י-ביטוח רכב"),
    amountAgorot: Buffer.from('25000'),
    category: 'ביטוח',
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

// ─── POST /merchant-buckets — create ─────────────────────────────────────────

describe('POST /merchant-buckets — create', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when userId is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/merchant-buckets',
      payload: { name: 'ביטוח רכב', descriptions: ['desc1'] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when name is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/merchant-buckets',
      payload: { userId: USER_ID, descriptions: ['desc1'] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when descriptions is empty', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/merchant-buckets',
      payload: { userId: USER_ID, name: 'ביטוח', descriptions: [] },
    })
    expect(res.statusCode).toBe(400)
  })

  it('creates a bucket and returns id, name, descriptions', async () => {
    vi.mocked(prisma.merchantBucket.create).mockResolvedValue(makeBucket() as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: '/merchant-buckets',
      payload: { userId: USER_ID, name: 'ביטוח רכב', descriptions: ["איי אי ג'י-ביטוח רכב"] },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json<{ bucket: { id: string; name: string; descriptions: string[] } }>()
    expect(body.bucket.id).toBe(BUCKET_ID)
    expect(body.bucket.name).toBe('ביטוח רכב')
    expect(body.bucket.descriptions).toEqual(["איי אי ג'י-ביטוח רכב"])
  })
})

// ─── GET /merchant-buckets — list ────────────────────────────────────────────

describe('GET /merchant-buckets — list', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when userId is missing', async () => {
    app = await buildApp()
    const res = await app.inject({ method: 'GET', url: '/merchant-buckets' })
    expect(res.statusCode).toBe(400)
  })

  it('returns list of buckets for the user', async () => {
    vi.mocked(prisma.merchantBucket.findMany).mockResolvedValue([makeBucket()] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ buckets: { id: string; name: string; descriptions: string[] }[] }>()
    expect(body.buckets).toHaveLength(1)
    expect(body.buckets[0]?.id).toBe(BUCKET_ID)
    expect(body.buckets[0]?.descriptions).toEqual(["איי אי ג'י-ביטוח רכב"])
  })

  it('returns only buckets belonging to the requesting user', async () => {
    vi.mocked(prisma.merchantBucket.findMany).mockResolvedValue([])
    app = await buildApp()

    await app.inject({ method: 'GET', url: `/merchant-buckets?userId=${USER_ID_OTHER}` })
    const call = vi.mocked(prisma.merchantBucket.findMany).mock.calls[0]?.[0]
    expect(call?.where).toMatchObject({ userId: USER_ID_OTHER })
  })
})

// ─── GET /merchant-buckets/:id — single ──────────────────────────────────────

describe('GET /merchant-buckets/:id — single bucket', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 404 when bucket does not exist', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns 404 when bucket belongs to a different user', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}?userId=${USER_ID_OTHER}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns bucket with id, name, descriptions array', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(makeBucket() as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ bucket: { id: string; name: string; descriptions: string[] } }>()
    expect(body.bucket.id).toBe(BUCKET_ID)
    expect(body.bucket.descriptions).toEqual(["איי אי ג'י-ביטוח רכב"])
  })
})

// ─── PATCH /merchant-buckets/:id — rename ────────────────────────────────────

describe('PATCH /merchant-buckets/:id — rename', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when name is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'PATCH',
      url: `/merchant-buckets/${BUCKET_ID}`,
      payload: { userId: USER_ID },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when bucket does not exist or belongs to another user', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'PATCH',
      url: `/merchant-buckets/${BUCKET_ID}`,
      payload: { userId: USER_ID, name: 'שם חדש' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('updates and returns new bucket name', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(makeBucket() as never)
    vi.mocked(prisma.merchantBucket.update).mockResolvedValue(
      makeBucket({ name: 'שם חדש' }) as never
    )
    app = await buildApp()

    const res = await app.inject({
      method: 'PATCH',
      url: `/merchant-buckets/${BUCKET_ID}`,
      payload: { userId: USER_ID, name: 'שם חדש' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ bucket: { name: string } }>()
    expect(body.bucket.name).toBe('שם חדש')
  })
})

// ─── POST /merchant-buckets/:id/descriptions — add description ───────────────

describe('POST /merchant-buckets/:id/descriptions — add', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when description is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/merchant-buckets/${BUCKET_ID}/descriptions`,
      payload: { userId: USER_ID },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when bucket does not exist or belongs to another user', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: `/merchant-buckets/${BUCKET_ID}/descriptions`,
      payload: { userId: USER_ID, description: 'XYZ ביטוח' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('adds a description and returns updated descriptions list', async () => {
    const updated = makeBucket({
      descriptions: [
        { bucketId: BUCKET_ID, description: "איי אי ג'י-ביטוח רכב", addedAt: new Date() },
        { bucketId: BUCKET_ID, description: 'XYZ ביטוח', addedAt: new Date() },
      ],
    })
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(makeBucket() as never)
    vi.mocked(prisma.merchantBucketDescription.create).mockResolvedValue({} as never)
    vi.mocked(prisma.merchantBucket.findFirst)
      .mockResolvedValueOnce(makeBucket() as never)
      .mockResolvedValueOnce(updated as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'POST',
      url: `/merchant-buckets/${BUCKET_ID}/descriptions`,
      payload: { userId: USER_ID, description: 'XYZ ביטוח' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ descriptions: string[] }>()
    expect(body.descriptions).toContain('XYZ ביטוח')
  })
})

// ─── DELETE /merchant-buckets/:id/descriptions — remove description ──────────

describe('DELETE /merchant-buckets/:id/descriptions — remove', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when description is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'DELETE',
      url: `/merchant-buckets/${BUCKET_ID}/descriptions`,
      payload: { userId: USER_ID },
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 404 when bucket does not exist or belongs to another user', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/merchant-buckets/${BUCKET_ID}/descriptions`,
      payload: { userId: USER_ID, description: 'foo' },
    })
    expect(res.statusCode).toBe(404)
  })

  it('removes a description and returns updated list', async () => {
    const afterDelete = makeBucket({ descriptions: [] })
    vi.mocked(prisma.merchantBucket.findFirst)
      .mockResolvedValueOnce(makeBucket() as never)
      .mockResolvedValueOnce(afterDelete as never)
    vi.mocked(prisma.merchantBucketDescription.deleteMany).mockResolvedValue({ count: 1 } as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/merchant-buckets/${BUCKET_ID}/descriptions`,
      payload: { userId: USER_ID, description: "איי אי ג'י-ביטוח רכב" },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ descriptions: string[] }>()
    expect(body.descriptions).toHaveLength(0)
  })
})

// ─── DELETE /merchant-buckets/:id — delete bucket ────────────────────────────

describe('DELETE /merchant-buckets/:id — delete bucket', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 404 when bucket does not exist', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/merchant-buckets/${BUCKET_ID}`,
      payload: { userId: USER_ID },
    })
    expect(res.statusCode).toBe(404)
  })

  it('deletes the bucket and returns 204', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(makeBucket() as never)
    vi.mocked(prisma.merchantBucket.delete).mockResolvedValue(makeBucket() as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'DELETE',
      url: `/merchant-buckets/${BUCKET_ID}`,
      payload: { userId: USER_ID },
    })
    expect(res.statusCode).toBe(204)
  })
})

// ─── GET /merchant-buckets/:id/transactions — query by bucket ────────────────

describe('GET /merchant-buckets/:id/transactions — transactions by bucket', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 404 when bucket does not exist', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(null)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}/transactions?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns transactions for all descriptions in the bucket', async () => {
    const bucket = makeBucket({
      descriptions: [
        { bucketId: BUCKET_ID, description: 'ביטוח א', addedAt: new Date() },
        { bucketId: BUCKET_ID, description: 'ביטוח ב', addedAt: new Date() },
      ],
    })
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(bucket as never)
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-1', description: Buffer.from('ביטוח א') }),
      makeTxRow({ id: 'tx-2', description: Buffer.from('ביטוח ב') }),
      makeTxRow({ id: 'tx-3', description: Buffer.from('קפה') }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}/transactions?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions.map(t => t.id).sort()).toEqual(['tx-1', 'tx-2'])
  })

  it('includes transactions from all descriptions in summary totalAgorot', async () => {
    const bucket = makeBucket({
      descriptions: [
        { bucketId: BUCKET_ID, description: 'ביטוח א', addedAt: new Date() },
        { bucketId: BUCKET_ID, description: 'ביטוח ב', addedAt: new Date() },
      ],
    })
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(bucket as never)
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-1',
        description: Buffer.from('ביטוח א'),
        amountAgorot: Buffer.from('10000'),
      }),
      makeTxRow({
        id: 'tx-2',
        description: Buffer.from('ביטוח ב'),
        amountAgorot: Buffer.from('5000'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}/transactions?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ summary: { totalAgorot: number } }>()
    expect(body.summary.totalAgorot).toBe(15000)
  })

  it('applies year filter to bucket transactions', async () => {
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(makeBucket() as never)
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-2026',
        transactionDate: new Date('2026-03-10'),
        description: Buffer.from("איי אי ג'י-ביטוח רכב"),
      }),
      makeTxRow({
        id: 'tx-2025',
        transactionDate: new Date('2025-11-05'),
        description: Buffer.from("איי אי ג'י-ביטוח רכב"),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}/transactions?userId=${USER_ID}&year=2026`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ transactions: { id: string }[] }>()
    expect(body.transactions).toHaveLength(1)
    expect(body.transactions[0]?.id).toBe('tx-2026')
  })

  it('returns summary with correct avgMonthlyAgorot across multi-description bucket', async () => {
    const bucket = makeBucket({
      descriptions: [
        { bucketId: BUCKET_ID, description: 'ביטוח א', addedAt: new Date() },
        { bucketId: BUCKET_ID, description: 'ביטוח ב', addedAt: new Date() },
      ],
    })
    vi.mocked(prisma.merchantBucket.findFirst).mockResolvedValue(bucket as never)
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    // Two descriptions, each appears in two different months
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({
        id: 'tx-1',
        transactionDate: new Date('2026-01-05'),
        description: Buffer.from('ביטוח א'),
        amountAgorot: Buffer.from('10000'),
      }),
      makeTxRow({
        id: 'tx-2',
        transactionDate: new Date('2026-02-05'),
        description: Buffer.from('ביטוח ב'),
        amountAgorot: Buffer.from('10000'),
      }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/${BUCKET_ID}/transactions?userId=${USER_ID}`,
    })
    const body = res.json<{ summary: { avgMonthlyAgorot: number } }>()
    // 20000 total across 2 distinct months = 10000 avg
    expect(body.summary.avgMonthlyAgorot).toBe(10000)
  })
})

// ─── GET /merchant-buckets/search-descriptions — find descriptions ────────────

describe('GET /merchant-buckets/search-descriptions — find matching descriptions', () => {
  let app: FastifyInstance

  afterEach(async () => {
    await app.close()
    vi.clearAllMocks()
  })

  it('returns 400 when userId is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/merchant-buckets/search-descriptions?q=ביטוח',
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns 400 when q is missing', async () => {
    app = await buildApp()
    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/search-descriptions?userId=${USER_ID}`,
    })
    expect(res.statusCode).toBe(400)
  })

  it('returns distinct description strings matching the query from user transactions', async () => {
    vi.mocked(prisma.account.findMany).mockResolvedValue([{ id: ACCOUNT_ID }] as never)
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      makeTxRow({ id: 'tx-1', description: Buffer.from('ביטוח רכב א') }),
      makeTxRow({ id: 'tx-2', description: Buffer.from('ביטוח רכב א') }),
      makeTxRow({ id: 'tx-3', description: Buffer.from('ביטוח חיים') }),
      makeTxRow({ id: 'tx-4', description: Buffer.from('דלק גלילות') }),
    ] as never)
    app = await buildApp()

    const res = await app.inject({
      method: 'GET',
      url: `/merchant-buckets/search-descriptions?userId=${USER_ID}&q=${encodeURIComponent('ביטוח')}`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json<{ descriptions: string[] }>()
    expect(body.descriptions).toContain('ביטוח רכב א')
    expect(body.descriptions).toContain('ביטוח חיים')
    expect(body.descriptions).not.toContain('דלק גלילות')
    // no duplicates
    expect(new Set(body.descriptions).size).toBe(body.descriptions.length)
  })
})
