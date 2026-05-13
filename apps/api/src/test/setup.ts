import { vi, beforeAll } from 'vitest'

// Set up required environment variables for tests
beforeAll(() => {
  process.env['JWT_SECRET'] = process.env['JWT_SECRET'] || 'test-secret-key'
  process.env['GOOGLE_CLIENT_ID'] = process.env['GOOGLE_CLIENT_ID'] || 'test-client-id'
  process.env['GOOGLE_CLIENT_SECRET'] = process.env['GOOGLE_CLIENT_SECRET'] || 'test-client-secret'
  process.env['GOOGLE_REDIRECT_URI'] =
    process.env['GOOGLE_REDIRECT_URI'] || 'http://localhost:3001/auth/google/callback'
})

vi.mock('../db/prisma', () => ({
  prisma: {
    $connect: vi.fn(),
    $disconnect: vi.fn(),
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    refreshToken: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
    },
    account: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    importBatch: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    recurringExpense: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    transactionNote: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    auditLog: { create: vi.fn() },
    // Executes each operation in the array sequentially and returns their results
    $transaction: vi.fn(async (ops: Promise<unknown>[]) => Promise.all(ops)),
  },
}))

vi.mock('ioredis', () => ({
  default: vi.fn().mockImplementation(() => ({
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    ping: vi.fn().mockResolvedValue('PONG'),
  })),
}))
