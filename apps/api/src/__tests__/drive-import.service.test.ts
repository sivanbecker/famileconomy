import { describe, it, expect, beforeEach, vi } from 'vitest'
import type { drive_v3 } from 'googleapis'
import { DriveImportService } from '../services/drive-import.service.js'
import { ImportService } from '../services/import.service.js'

vi.mock('../services/import.service.js')

describe('DriveImportService', () => {
  let service: DriveImportService
  let mockDrive: Partial<drive_v3.Drive>

  beforeEach(() => {
    service = new DriveImportService()
    mockDrive = {
      files: {
        list: vi.fn(),
        get: vi.fn(),
      },
    } as unknown as Partial<drive_v3.Drive>

    vi.mocked(ImportService).mockImplementation(
      () =>
        ({
          importCsv: vi
            .fn()
            .mockResolvedValue({ inserted: 2, duplicates: 0, withinFileDuplicates: 0, errors: [] }),
        }) as never
    )
  })

  describe('detectProvider', () => {
    it('detects MAX from filename', () => {
      expect(service.detectProvider('MAX_CARD_2026_05.csv')).toBe('MAX')
      expect(service.detectProvider('max_report.csv')).toBe('MAX')
    })

    it('detects CAL from filename', () => {
      expect(service.detectProvider('CAL_2026_05.csv')).toBe('CAL')
      expect(service.detectProvider('cal_statement.csv')).toBe('CAL')
    })

    it('throws error for unknown provider', () => {
      expect(() => service.detectProvider('unknown_file.csv')).toThrow('UNKNOWN_PROVIDER')
    })

    it('is case-insensitive', () => {
      expect(service.detectProvider('MaX_card.csv')).toBe('MAX')
      expect(service.detectProvider('CaL_bill.csv')).toBe('CAL')
    })
  })

  describe('walkFolder', () => {
    it('returns all CSV files in folder', async () => {
      const mockList = vi.fn().mockResolvedValueOnce({
        data: {
          files: [
            { id: 'file1', name: 'MAX_CARD_2026_05.csv', mimeType: 'text/csv' },
            { id: 'file2', name: 'CAL_2026_05.csv', mimeType: 'text/csv' },
          ],
        },
      })
      mockDrive.files = { list: mockList } as never

      const files = await service.walkFolder(mockDrive as drive_v3.Drive, 'folder123')

      expect(files).toHaveLength(2)
      expect(files[0]).toEqual({ id: 'file1', name: 'MAX_CARD_2026_05.csv' })
    })

    it('recursively walks subfolders', async () => {
      const mockList = vi
        .fn()
        .mockResolvedValueOnce({
          data: {
            files: [
              {
                id: 'subfolder1',
                name: 'subfolder',
                mimeType: 'application/vnd.google-apps.folder',
              },
              { id: 'file1', name: 'MAX_2026_05.csv', mimeType: 'text/csv' },
            ],
          },
        })
        .mockResolvedValueOnce({
          data: {
            files: [{ id: 'file2', name: 'CAL_2026_04.csv', mimeType: 'text/csv' }],
          },
        })
      mockDrive.files = { list: mockList } as never

      const files = await service.walkFolder(mockDrive as drive_v3.Drive, 'folder123')

      expect(files).toHaveLength(2)
      expect(files).toContainEqual({ id: 'file1', name: 'MAX_2026_05.csv' })
      expect(files).toContainEqual({ id: 'file2', name: 'CAL_2026_04.csv' })
    })

    it('skips trashed files', async () => {
      const mockList = vi.fn().mockResolvedValueOnce({
        data: {
          files: [
            { id: 'file1', name: 'MAX_2026_05.csv', mimeType: 'text/csv', trashed: false },
            { id: 'file2', name: 'DELETED.csv', mimeType: 'text/csv', trashed: true },
          ],
        },
      })
      mockDrive.files = { list: mockList } as never

      const files = await service.walkFolder(mockDrive as drive_v3.Drive, 'folder123')

      expect(files).toHaveLength(1)
      expect(files[0]?.id).toBe('file1')
    })

    it('returns empty array for empty folder', async () => {
      const mockList = vi.fn().mockResolvedValueOnce({
        data: { files: [] },
      })
      mockDrive.files = { list: mockList } as never

      const files = await service.walkFolder(mockDrive as drive_v3.Drive, 'empty_folder')

      expect(files).toHaveLength(0)
    })
  })

  describe('downloadFile', () => {
    it('downloads file content as text', async () => {
      const csvContent = 'date,amount,description\n2026-05-01,100,test'
      const mockGet = vi.fn().mockResolvedValueOnce({
        data: csvContent,
      })
      mockDrive.files = { get: mockGet } as never

      const content = await service.downloadFile(mockDrive as drive_v3.Drive, 'file123')

      expect(content).toBe(csvContent)
    })

    it('handles UTF-8 encoded content', async () => {
      const csvContent = 'תאריך,סכום,תיאור\n2026-05-01,100,בדיקה'
      const mockGet = vi.fn().mockResolvedValueOnce({
        data: csvContent,
      })
      mockDrive.files = { get: mockGet } as never

      const content = await service.downloadFile(mockDrive as drive_v3.Drive, 'file123')

      expect(content).toBe(csvContent)
    })
  })

  describe('importFromDrive', () => {
    it('service is instantiated', () => {
      expect(service).toBeDefined()
      expect(service.detectProvider).toBeDefined()
      expect(service.walkFolder).toBeDefined()
      expect(service.downloadFile).toBeDefined()
      expect(service.importFromDrive).toBeDefined()
    })
  })
})
