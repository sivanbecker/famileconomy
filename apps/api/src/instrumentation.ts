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
    // The SDK reads OTEL_EXPORTER_OTLP_ENDPOINT and OTEL_EXPORTER_OTLP_HEADERS
    // automatically from env — no need to pass them explicitly
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false }, // too noisy
      }),
    ],
  })

  sdk.start()

  process.on('SIGTERM', () => {
    sdk.shutdown().finally(() => process.exit(0))
  })
}
