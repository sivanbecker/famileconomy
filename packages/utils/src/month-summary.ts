export interface TransactionSummaryInput {
  amountAgorot: number
  // Rows from bank imports (salary, transfer-in) set isIncome: true.
  // Credit-card rows never set this — negative amounts there are refunds/reversals.
  isIncome?: boolean
}

export interface MonthSummary {
  incomeAgorot: number
  expensesAgorot: number
  balanceAgorot: number
}

export function summarizeMonth(transactions: TransactionSummaryInput[]): MonthSummary {
  let incomeAgorot = 0
  let netExpensesAgorot = 0

  for (const tx of transactions) {
    if (!Number.isInteger(tx.amountAgorot)) {
      throw new Error(`summarizeMonth requires integer amounts, got: ${tx.amountAgorot}`)
    }
    if (tx.isIncome === true) {
      incomeAgorot += tx.amountAgorot
    } else {
      // Positive = debit; negative = refund/reversal (reduces expenses, never adds to income)
      netExpensesAgorot += tx.amountAgorot
    }
  }

  const expensesAgorot = Math.max(0, netExpensesAgorot)
  return { incomeAgorot, expensesAgorot, balanceAgorot: incomeAgorot - expensesAgorot }
}
