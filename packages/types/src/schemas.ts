import { z } from 'zod'

export const createTransactionSchema = z.object({
  amount: z.number().int().positive(),
  currency: z.enum(['ILS', 'USD', 'EUR']),
  merchantRaw: z.string().min(1).max(255),
  categoryId: z.string().uuid().optional(),
  date: z.string().datetime(),
  notes: z.string().max(500).optional(),
})
export type CreateTransactionData = z.infer<typeof createTransactionSchema>

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})
export type LoginData = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})
export type RegisterData = z.infer<typeof registerSchema>

export const createRecurringSchema = z.object({
  name: z.string().min(1).max(100),
  merchantMatchPattern: z.string().min(1).max(255),
  expectedAmount: z.number().int().positive(),
  amountTolerancePct: z.number().min(0).max(1),
  dayOfMonth: z.number().int().min(1).max(31),
})
export type CreateRecurringData = z.infer<typeof createRecurringSchema>
