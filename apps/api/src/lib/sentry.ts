import * as Sentry from '@sentry/node'

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
  const dsn = process.env['SENTRY_DSN']
  if (!dsn || process.env['NODE_ENV'] === 'test') return

  const release = process.env['npm_package_version']

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    ...(release !== undefined && { release }),
    sampleRate: 1.0,
    tracesSampleRate: process.env['NODE_ENV'] === 'production' ? 0.1 : 1.0,
    beforeSend(event) {
      // Strip request body and any financial/PII fields before sending to Sentry
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
