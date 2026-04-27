import pino from 'pino'

const isDev = process.env['NODE_ENV'] === 'development'
const isTest = process.env['NODE_ENV'] === 'test'

function buildTransport():
  | { transport: pino.TransportSingleOptions | pino.TransportMultiOptions }
  | Record<string, never> {
  const targets: pino.TransportTargetOptions[] = []

  if (isDev) {
    targets.push({ target: 'pino-pretty', level: 'debug', options: { colorize: true } })
  }

  const logtailToken = process.env['LOGTAIL_SOURCE_TOKEN']
  if (logtailToken) {
    targets.push({
      target: '@logtail/pino',
      level: 'info',
      options: { sourceToken: logtailToken },
    })
  }

  if (targets.length === 0) return {}
  if (targets.length === 1) {
    return { transport: targets[0] as pino.TransportSingleOptions }
  }
  return { transport: { targets } as pino.TransportMultiOptions }
}

export const pinoOptions: pino.LoggerOptions = {
  level: isTest ? 'silent' : isDev ? 'debug' : 'info',
  ...(!isTest && buildTransport()),
  base: { service: process.env['OTEL_SERVICE_NAME'] ?? 'famileconomy-api' },
  redact: {
    // Never log financial amounts or PII — log record IDs only
    paths: ['*.amount', '*.balance', '*.password', '*.token', '*.secret', '*.pan'],
    censor: '[REDACTED]',
  },
}

// Standalone logger for use outside of Fastify (entrypoint errors, scripts)
export const logger = pino(pinoOptions)
