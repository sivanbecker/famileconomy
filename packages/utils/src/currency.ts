/**
 * Convert a display value (e.g. 10.50 entered by user) to integer shekels (1050).
 * Always use this before storing or computing with monetary values.
 */
export function toShekels(displayValue: number): number {
  return Math.round(displayValue * 100)
}

/**
 * Convert integer shekels (1050) to a formatted display string ("10.50").
 * Use Intl.NumberFormat for locale-aware formatting in components.
 */
export function fromShekels(shekels: number): string {
  return (shekels / 100).toFixed(2)
}

/**
 * Format integer shekels as a localized ILS currency string (e.g. "₪10.50").
 */
export function formatILS(shekels: number, locale = 'he-IL'): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 2,
  }).format(shekels / 100)
}
