export interface DedupeHashInput {
  accountId: string
  transactionDate: Date
  amountAgorot: number
  description: string
}

export function computeDedupeHash(_input: DedupeHashInput): string {
  throw new Error('not implemented')
}
