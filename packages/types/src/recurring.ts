export type RecurringExpense = {
  id: string
  userId: string
  name: string
  merchantMatchPattern: string
  expectedAmount: number // integer shekels
  amountTolerancePct: number // e.g. 0.15 = 15%
  dayOfMonth: number // 1–31
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}
