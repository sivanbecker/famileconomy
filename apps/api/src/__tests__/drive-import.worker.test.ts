import { describe, it, expect, beforeEach, vi } from 'vitest'
import { DriveImportWorker } from '../workers/drive-import.worker.js'

vi.mock('../services/google-oauth.service.js')
vi.mock('../services/drive-import.service.js')
vi.mock('../db/prisma.js', () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

describe('DriveImportWorker', () => {
  let worker: DriveImportWorker

  beforeEach(() => {
    worker = new DriveImportWorker()
  })

  describe('processJob', () => {
    it('is instantiated', () => {
      expect(worker).toBeDefined()
      expect(worker.processJob).toBeDefined()
    })

    it('static start method exists', () => {
      expect(DriveImportWorker.start).toBeDefined()
    })
  })
})
