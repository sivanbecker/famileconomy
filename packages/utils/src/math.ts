/**
 * Safe integer addition for monetary amounts.
 * Throws if either input is not a safe integer (guards against float drift).
 */
export function addShekels(a: number, b: number): number {
  if (!Number.isInteger(a) || !Number.isInteger(b)) {
    throw new Error(`addShekels requires integers, got: ${a}, ${b}`)
  }
  return a + b
}

/**
 * Budget remaining — always floor (never report money you don't have).
 */
export function budgetRemaining(budgetAmount: number, spent: number): number {
  return Math.max(0, Math.floor(budgetAmount - spent))
}

/**
 * Percentage of budget spent, capped at 100.
 */
export function budgetPct(budgetAmount: number, spent: number): number {
  if (budgetAmount === 0) return 0
  return Math.min(100, Math.round((spent / budgetAmount) * 100))
}
