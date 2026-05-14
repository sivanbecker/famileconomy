import { describe, it, expect } from 'vitest'
import { computeDedupeHash } from '../lib/parsers/dedup-hash'

describe('computeDedupeHash', () => {
  const base = {
    accountId: 'acc-123',
    transactionDate: new Date('2026-04-09'),
    amountAgorot: 1700,
    description: 'מאפיית בראשית',
  }

  it('returns a non-empty hex string', () => {
    const hash = computeDedupeHash(base)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('is deterministic — same inputs always produce the same hash', () => {
    expect(computeDedupeHash(base)).toBe(computeDedupeHash(base))
  })

  it('differs when accountId changes', () => {
    const other = { ...base, accountId: 'acc-999' }
    expect(computeDedupeHash(base)).not.toBe(computeDedupeHash(other))
  })

  it('differs when transactionDate changes', () => {
    const other = { ...base, transactionDate: new Date('2026-04-10') }
    expect(computeDedupeHash(base)).not.toBe(computeDedupeHash(other))
  })

  it('differs when amountAgorot changes', () => {
    const other = { ...base, amountAgorot: 1701 }
    expect(computeDedupeHash(base)).not.toBe(computeDedupeHash(other))
  })

  it('differs when description changes', () => {
    const other = { ...base, description: 'אחר' }
    expect(computeDedupeHash(base)).not.toBe(computeDedupeHash(other))
  })

  it('is case-sensitive on description', () => {
    const lower = { ...base, description: 'amazon' }
    const upper = { ...base, description: 'AMAZON' }
    expect(computeDedupeHash(lower)).not.toBe(computeDedupeHash(upper))
  })

  it('normalises extra whitespace in description before hashing', () => {
    const padded = { ...base, description: 'מאפיית   בראשית' }
    const normal = { ...base, description: 'מאפיית בראשית' }
    expect(computeDedupeHash(padded)).toBe(computeDedupeHash(normal))
  })

  it('handles negative amounts (credits / cancellations)', () => {
    const credit = { ...base, amountAgorot: -17600 }
    const debit = { ...base, amountAgorot: 17600 }
    expect(computeDedupeHash(credit)).not.toBe(computeDedupeHash(debit))
  })

  it('handles zero amount', () => {
    const zero = { ...base, amountAgorot: 0 }
    expect(() => computeDedupeHash(zero)).not.toThrow()
  })

  it('handles very large amounts (near Number.MAX_SAFE_INTEGER)', () => {
    const big = { ...base, amountAgorot: Number.MAX_SAFE_INTEGER }
    expect(() => computeDedupeHash(big)).not.toThrow()
  })

  // ─── Installment hashing ────────────────────────────────────────────────────

  it('two consecutive monthly installments of the same purchase produce DIFFERENT hashes', () => {
    // CAL reports installments by original purchase date — so date, amount, and description
    // are identical every month. Only installmentNum changes.
    const installment13 = { ...base, installmentNum: 13 }
    const installment14 = { ...base, installmentNum: 14 }
    expect(computeDedupeHash(installment13)).not.toBe(computeDedupeHash(installment14))
  })

  it('non-installment row (installmentNum=null) differs from installment row 1/N', () => {
    const plain = { ...base, installmentNum: null }
    const first = { ...base, installmentNum: 1 }
    expect(computeDedupeHash(plain)).not.toBe(computeDedupeHash(first))
  })

  it('same installment number on same date/amount/description → same hash (idempotent re-import)', () => {
    const a = { ...base, installmentNum: 3 }
    const b = { ...base, installmentNum: 3 }
    expect(computeDedupeHash(a)).toBe(computeDedupeHash(b))
  })
})
