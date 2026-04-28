import { createHash } from 'node:crypto'

export interface DedupeHashInput {
  accountId: string
  transactionDate: Date
  amountAgorot: number
  description: string
}

export function computeDedupeHash(input: DedupeHashInput): string {
  const normalised = input.description.replace(/\s+/g, ' ').trim()
  const dateStr = input.transactionDate.toISOString().slice(0, 10)
  const payload = `${input.accountId}|${dateStr}|${input.amountAgorot}|${normalised}`
  return createHash('sha256').update(payload, 'utf8').digest('hex')
}
