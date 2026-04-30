export interface CategoryBreakdownInput {
  amountAgorot: number
  category: string | null | undefined
  isIncome?: boolean
}

export interface CategoryBreakdownSlice {
  category: string
  amountAgorot: number
  percent: number
}

const UNCATEGORIZED = 'אחר'

export function categoryBreakdown(
  transactions: CategoryBreakdownInput[]
): CategoryBreakdownSlice[] {
  const totals = new Map<string, number>()

  for (const tx of transactions) {
    if (tx.isIncome === true) continue
    if (tx.amountAgorot <= 0) continue

    const key = tx.category ?? UNCATEGORIZED
    totals.set(key, (totals.get(key) ?? 0) + tx.amountAgorot)
  }

  if (totals.size === 0) return []

  let grandTotal = 0
  for (const v of totals.values()) grandTotal += v

  const slices: CategoryBreakdownSlice[] = []
  for (const [category, amountAgorot] of totals) {
    slices.push({
      category,
      amountAgorot,
      percent: grandTotal === 0 ? 0 : (amountAgorot / grandTotal) * 100,
    })
  }

  slices.sort((a, b) => b.amountAgorot - a.amountAgorot)

  return slices
}
