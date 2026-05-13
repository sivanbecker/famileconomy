export interface ParsedTransaction {
  transactionDate: Date
  chargeDate: Date | null
  description: string
  amountAgorot: number
  originalAmountAgorot: number
  originalCurrency: string
  category: string | null
  cardLastFour: string | null
  installmentNum: number | null
  installmentOf: number | null
  isPending: boolean
  notes: string | null
}
