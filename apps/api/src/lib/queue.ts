import { Queue } from 'bullmq'
import type { DriveImportJobData } from './drive-import-types.js'
import Redis from 'ioredis'
import { createHash } from 'crypto'

let driveImportQueue: Queue<DriveImportJobData> | null = null

export function getDriveImportQueue(): Queue<DriveImportJobData> {
  if (!driveImportQueue) {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    })

    driveImportQueue = new Queue<DriveImportJobData>('drive-import', {
      connection: redis,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: true,
        removeOnFail: false,
      },
    })
  }

  return driveImportQueue
}

export function generateDriveImportJobId(
  userId: string,
  type: 'folder' | 'file',
  resourceId: string
): string {
  const dateStr = new Date().toISOString().split('T')[0]
  const input = `${userId}|${type}|${resourceId}|${dateStr}`
  return createHash('sha256').update(input).digest('hex')
}
