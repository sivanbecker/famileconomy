import type { drive_v3 } from 'googleapis'
import type { DriveImportJobData, DriveImportProgress } from '../lib/drive-import-types.js'
import type { Job } from 'bullmq'
import { ImportService, type Provider } from './import.service.js'

export class DriveImportService {
  private importService = new ImportService()

  detectProvider(filename: string): Provider {
    const lower = filename.toLowerCase()
    if (lower.includes('max')) return 'MAX'
    if (lower.includes('cal')) return 'CAL'
    throw new Error('UNKNOWN_PROVIDER')
  }

  async walkFolder(
    driveClient: drive_v3.Drive,
    folderId: string
  ): Promise<Array<{ id: string; name: string }>> {
    const files: Array<{ id: string; name: string }> = []
    const queue: string[] = [folderId]
    const visited = new Set<string>()

    while (queue.length > 0) {
      const currentId = queue.shift()
      if (!currentId || visited.has(currentId)) continue
      visited.add(currentId)

      const response = await driveClient.files.list({
        q: `'${currentId}' in parents and trashed=false`,
        fields: 'files(id, name, mimeType)',
        spaces: 'drive',
      })

      const driveFiles = response.data.files || []
      for (const file of driveFiles) {
        if (!file.id || !file.name) continue
        if (file.trashed) continue

        if (file.mimeType === 'text/csv') {
          files.push({ id: file.id, name: file.name })
        } else if (file.mimeType === 'application/vnd.google-apps.folder') {
          queue.push(file.id)
        }
      }
    }

    return files
  }

  async downloadFile(driveClient: drive_v3.Drive, fileId: string): Promise<string> {
    const response = await driveClient.files.get({
      fileId,
      alt: 'media',
    })

    return response.data as string
  }

  async importFromDrive(
    job: Job<DriveImportJobData>,
    driveClient: drive_v3.Drive
  ): Promise<DriveImportProgress> {
    const { userId, type, resourceId } = job.data
    const progress: DriveImportProgress = {
      phase: 'walking',
      totalFiles: 0,
      processedFiles: 0,
      inserted: 0,
      duplicates: 0,
      errors: [],
    }

    await job.updateProgress(progress)

    let files: Array<{ id: string; name: string }> = []

    if (type === 'folder') {
      files = await this.walkFolder(driveClient, resourceId)
    } else {
      const fileResponse = await driveClient.files.get({
        fileId: resourceId,
        fields: 'id, name',
      })
      if (fileResponse.data.id && fileResponse.data.name) {
        files = [{ id: fileResponse.data.id, name: fileResponse.data.name }]
      }
    }

    progress.phase = 'importing'
    progress.totalFiles = files.length
    await job.updateProgress(progress)

    for (const file of files) {
      try {
        const content = await this.downloadFile(driveClient, file.id)
        const provider = this.detectProvider(file.name)

        const result = await this.importService.importCsv({
          csv: content,
          filename: file.name,
          provider,
          userId,
        })

        progress.inserted += result.inserted
        progress.duplicates += result.duplicates
        progress.processedFiles += 1

        if (result.errors.length > 0) {
          progress.errors.push(`${file.name}: ${result.errors.join('; ')}`)
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        progress.errors.push(`${file.name}: ${errorMsg}`)
        progress.processedFiles += 1
      }

      await job.updateProgress(progress)
    }

    progress.phase = 'complete'
    return progress
  }
}
