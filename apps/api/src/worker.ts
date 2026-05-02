import './instrumentation.js'
import { DriveImportWorker } from './workers/drive-import.worker.js'
import { logger } from './lib/logger.js'

async function main() {
  try {
    DriveImportWorker.start()
    logger.info('All workers started successfully')
  } catch (error) {
    logger.error({ error }, 'Failed to start workers')
    process.exit(1)
  }
}

main()
