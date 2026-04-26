export type TransactionType = 'expense' | 'income' | 'transfer'

export type Transaction = {
  id: string
  userId: string
  amount: number // integer shekels — never float
  currency: 'ILS' | 'USD' | 'EUR'
  merchantRaw: string
  categoryId: string | null
  type: TransactionType
  date: Date
  notes: string | null
  importBatchId: string | null
  matchedRecurringId: string | null
  installmentGroupId: string | null
  installmentIndex: number | null
  installmentTotal: number | null
  hash: string // SHA-256 dedup hash
  createdAt: Date
  updatedAt: Date
}

export type TransactionWithCategory = Transaction & {
  category: { id: string; name: string; icon: string } | null
}
