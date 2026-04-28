import { describe, it, expect } from 'vitest'
import { loginSchema, registerSchema } from '../lib/schemas'

describe('loginSchema', () => {
  it('accepts valid email and password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'secret123' })
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'secret123' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing fields', () => {
    expect(loginSchema.safeParse({}).success).toBe(false)
  })
})

describe('registerSchema', () => {
  const valid = {
    email: 'user@example.com',
    password: 'Secret123!',
    name: 'Sivan',
    locale: 'he',
  }

  it('accepts valid registration data', () => {
    expect(registerSchema.safeParse(valid).success).toBe(true)
  })

  it('rejects password shorter than 8 characters', () => {
    expect(registerSchema.safeParse({ ...valid, password: 'abc' }).success).toBe(false)
  })

  it('rejects empty name', () => {
    expect(registerSchema.safeParse({ ...valid, name: '' }).success).toBe(false)
  })

  it('rejects invalid locale', () => {
    expect(registerSchema.safeParse({ ...valid, locale: 'fr' }).success).toBe(false)
  })

  it('accepts locale "en"', () => {
    expect(registerSchema.safeParse({ ...valid, locale: 'en' }).success).toBe(true)
  })
})
