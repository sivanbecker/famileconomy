import { Worker, type Job } from 'bullmq'
import Redis from 'ioredis'
import type { drive_v3 } from 'googleapis'
import type { DriveImportJobData, DriveImportProgress } from '../lib/drive-import-types.js'
import { DriveImportService } from '../services/drive-import.service.js'
import { GoogleOAuthService } from '../services/google-oauth.service.js'
import { prisma } from '../db/prisma.js'
import { logger } from '../lib/logger.js'

export class DriveImportWorker {
  private driveImportService = new DriveImportService()
  private oauthService = new GoogleOAuthService()

  async processJob(job: Job<DriveImportJobData>): Promise<DriveImportProgress> {
    const { userId, type, resourceId } = job.data

    logger.info({ jobId: job.id, userId, type, resourceId }, 'Starting drive import job')

    const progress: DriveImportProgress = {
      phase: 'walking',
      totalFiles: 0,
      processedFiles: 0,
      inserted: 0,
      duplicates: 0,
      errors: [],
    }

    try {
      const driveClient = await this.getAuthorizedClient(userId)
      const result = await this.executeImport(job, driveClient)

      await this.writeAuditLog(userId, 'GOOGLE_DRIVE_IMPORT_COMPLETE', {
        type,
        resourceId,
        inserted: result.inserted,
        duplicates: result.duplicates,
        errorCount: result.errors.length,
      })

      return result
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      logger.error({ jobId: job.id, userId, error: errorMsg }, 'Drive import job failed')

      progress.phase = 'error'
      progress.errors = [errorMsg]

      await job.updateProgress(progress)

      await this.writeAuditLog(userId, 'GOOGLE_DRIVE_IMPORT_FAILED', {
        type,
        resourceId,
        error: errorMsg,
      })

      throw error
    }
  }

  private async getAuthorizedClient(userId: string): Promise<drive_v3.Drive> {
    const oauth2Client = await this.oauthService.getAuthorizedClient(userId)
    const { google } = await import('googleapis')
    return google.drive({ version: 'v3', auth: oauth2Client })
  }

  private async executeImport(
    job: Job<DriveImportJobData>,
    driveClient: drive_v3.Drive
  ): Promise<DriveImportProgress> {
    return this.driveImportService.importFromDrive(job as Job<DriveImportJobData>, driveClient)
  }

  private async writeAuditLog(
    userId: string,
    action: 'GOOGLE_DRIVE_IMPORT_COMPLETE' | 'GOOGLE_DRIVE_IMPORT_FAILED',
    details: Record<string, unknown>
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          tableName: 'transactions',
          recordId: userId,
          newValues: details as never,
        },
      })
    } catch (error) {
      logger.error({ userId, error }, 'Failed to write audit log')
    }
  }

  static start(): Worker<DriveImportJobData> {
    const redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    })

    const worker = new Worker<DriveImportJobData>(
      'drive-import',
      async job => {
        const processor = new DriveImportWorker()
        return processor.processJob(job)
      },
      {
        connection: redis,
        concurrency: 1,
      }
    )

    worker.on('completed', job => {
      logger.info({ jobId: job.id }, 'Drive import job completed')
    })

    worker.on('failed', (job, err) => {
      logger.error({ jobId: job?.id, error: err.message }, 'Drive import job failed')
    })

    logger.info('Drive import worker started')

    return worker
  }
}
