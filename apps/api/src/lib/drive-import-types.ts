export type DriveResourceType = 'folder' | 'file'

export interface DriveImportJobData {
  userId: string
  type: DriveResourceType
  resourceId: string
}

export interface DriveImportProgress {
  phase: 'walking' | 'importing' | 'complete' | 'error'
  totalFiles: number
  processedFiles: number
  inserted: number
  duplicates: number
  withinFileDuplicates: number
  errors: string[]
}

export interface DriveImportJobStatus {
  jobId: string
  status: 'waiting' | 'active' | 'completed' | 'failed'
  progress: DriveImportProgress
}
