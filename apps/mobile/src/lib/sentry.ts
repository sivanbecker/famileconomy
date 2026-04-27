import * as Sentry from '@sentry/react-native'

const FINANCIAL_FIELDS = new Set([
  'amount',
  'balance',
  'credit',
  'debit',
  'total',
  'sum',
  'pan',
  'card_number',
  'account_number',
  'iban',
  'password',
  'token',
  'secret',
  'refresh_token',
])

function scrubFinancialData(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(scrubFinancialData)
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    // eslint-disable-next-line security/detect-object-injection -- key comes from Object.entries, value is sanitized
    result[key] = FINANCIAL_FIELDS.has(key.toLowerCase()) ? '[REDACTED]' : scrubFinancialData(value)
  }
  return result
}

export function initSentry(): void {
  const dsn = process.env['EXPO_PUBLIC_SENTRY_DSN']
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    sampleRate: 1.0,
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      if (event.request?.data) {
        event.request.data = '[REDACTED]'
      }
      if (event.extra) {
        event.extra = scrubFinancialData(event.extra) as Record<string, unknown>
      }
      return event
    },
  })
}
