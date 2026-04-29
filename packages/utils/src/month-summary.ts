export interface TransactionSummaryInput {
  amountAgorot: number
}

export interface MonthSummary {
  incomeAgorot: number
  expensesAgorot: number
  balanceAgorot: number
}

export function summarizeMonth(transactions: TransactionSummaryInput[]): MonthSummary {
  let incomeAgorot = 0
  let expensesAgorot = 0

  for (const tx of transactions) {
    if (!Number.isInteger(tx.amountAgorot)) {
      throw new Error(`summarizeMonth requires integer amounts, got: ${tx.amountAgorot}`)
    }
    if (tx.amountAgorot < 0) {
      incomeAgorot += -tx.amountAgorot
    } else {
      expensesAgorot += tx.amountAgorot
    }
  }

  return { incomeAgorot, expensesAgorot, balanceAgorot: incomeAgorot - expensesAgorot }
}
