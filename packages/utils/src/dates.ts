/**
 * Parse a DD/MM/YYYY string (Israeli bank CSV format) into a Date.
 */
export function parseBankDate(ddmmyyyy: string): Date {
  const [day, month, year] = ddmmyyyy.split('/')
  if (!day || !month || !year) throw new Error(`Invalid bank date format: ${ddmmyyyy}`)
  return new Date(Date.UTC(parseInt(year, 10), parseInt(month, 10) - 1, parseInt(day, 10)))
}

/**
 * Format a Date as DD/MM/YYYY for display.
 */
export function formatBankDate(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, '0')
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const y = date.getUTCFullYear()
  return `${d}/${m}/${y}`
}

/**
 * Return { month, year } for a given Date (UTC).
 */
export function getMonthYear(date: Date): { month: number; year: number } {
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() }
}
