export type Budget = {
  id: string
  userId: string
  categoryId: string | null // null = total budget
  amount: number // integer shekels
  month: number // 1–12
  year: number
  createdAt: Date
  updatedAt: Date
}

export type BudgetSummary = {
  budget: Budget
  spent: number // integer shekels
  remaining: number // integer shekels — Math.floor always
  pct: number // 0–100
}
