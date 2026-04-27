import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { Resource } from '@opentelemetry/resources'
import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions'

const endpoint = process.env['OTEL_EXPORTER_OTLP_ENDPOINT']
const serviceName = process.env['OTEL_SERVICE_NAME'] ?? 'famileconomy-api'
const serviceVersion = process.env['npm_package_version'] ?? '0.0.0'

// No-op in test — avoids port conflicts and noise
if (process.env['NODE_ENV'] !== 'test' && endpoint) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    }),
    traceExporter: new OTLPTraceExporter({
      url: `${endpoint}/v1/traces`,
      headers: {
        // Grafana Cloud uses Authorization: Basic <base64(instanceId:token)>
        // Set OTEL_EXPORTER_OTLP_HEADERS="Authorization=Basic <value>" in Railway env
        ...(process.env['OTEL_EXPORTER_OTLP_HEADERS']
          ? Object.fromEntries(
              process.env['OTEL_EXPORTER_OTLP_HEADERS'].split(',').map(h => {
                const [k, ...v] = h.split('=')
                return [k?.trim() ?? '', v.join('=').trim()]
              })
            )
          : {}),
      },
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        // Fastify, pg, ioredis, http — all auto-instrumented
        '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
      }),
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0))
  })
}
