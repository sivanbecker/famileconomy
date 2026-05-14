import { createHash } from 'node:crypto'

export interface DedupeHashInput {
  accountId: string
  transactionDate: Date
  amountAgorot: number
  description: string
  // CAL reports installments by original purchase date, so date+amount+description
  // repeats every billing cycle. Including installmentNum makes each month unique.
  installmentNum?: number | null
}

export function computeDedupeHash(input: DedupeHashInput): string {
  const normalised = input.description.replace(/\s+/g, ' ').trim()
  const dateStr = input.transactionDate.toISOString().slice(0, 10)
  const installment = input.installmentNum != null ? `|inst:${input.installmentNum}` : ''
  const payload = `${input.accountId}|${dateStr}|${input.amountAgorot}|${normalised}${installment}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}
