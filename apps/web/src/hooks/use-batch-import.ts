'use client'

import { useState, useRef, useMemo } from 'react'
import axios from 'axios'
import { apiClient } from '../lib/api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Provider = 'MAX' | 'CAL'

export type FileImportStatus = 'pending' | 'uploading' | 'imported' | 'already_imported' | 'error'

export type BatchPhase = 'idle' | 'running' | 'aborted' | 'done'

export interface ImportResult {
  inserted: number
  duplicates: number
  withinFileDuplicates: number
  pendingSkipped: number
  errors: string[]
  skippedRows: unknown[]
}

export interface FileImportEntry {
  file: File
  relativePath: string
  status: FileImportStatus
  result: ImportResult | null
  errorMessage: string | null
}

export interface BatchState {
  phase: BatchPhase
  entries: FileImportEntry[]
  currentIndex: number
}

export interface BatchTotals {
  inserted: number
  duplicates: number
  withinFileDuplicates: number
  pendingSkipped: number
  alreadyImported: number
  errors: number
}

interface UseBatchImportReturn {
  batchState: BatchState
  startBatch: (files: File[], provider: Provider, userId: string) => Promise<void>
  abort: () => void
  reset: () => void
  totals: BatchTotals
}

// ─── File Filtering ───────────────────────────────────────────────────────────

/**
 * Filters a FileList from a webkitdirectory input to only include files
 * relevant to the given provider, based on path depth and extension.
 *
 * MAX: flat folder → .xlsx/.xlsm at depth 1 only
 * CAL: year/month structure → .csv at depth 1 (root) or depth 2 (month subfolder)
 *
 * depth = segments.length - 1, where segments = relativePath.split('/')
 * (segment[0] is always the root folder name chosen by the user)
 */
export function filterFilesForFolder(fileList: FileList, provider: Provider): File[] {
  const files: File[] = []

  for (let i = 0; i < fileList.length; i++) {
    const file = fileList[i] // eslint-disable-line security/detect-object-injection
    if (!file) continue

    const relativePath = file.webkitRelativePath
    if (!relativePath) continue

    const segments = relativePath.split('/')
    const depth = segments.length - 1
    const name = file.name.toLowerCase()

    if (provider === 'MAX') {
      if (depth === 1 && (name.endsWith('.xlsx') || name.endsWith('.xlsm'))) {
        files.push(file)
      }
    } else {
      if ((depth === 1 || depth === 2) && name.endsWith('.csv')) {
        files.push(file)
      }
    }
  }

  return files.sort((a, b) => a.webkitRelativePath.localeCompare(b.webkitRelativePath))
}

// ─── Constants ────────────────────────────────────────────────────────────────

const INITIAL_BATCH_STATE: BatchState = {
  phase: 'idle',
  entries: [],
  currentIndex: -1,
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBatchImport(): UseBatchImportReturn {
  const [batchState, setBatchState] = useState<BatchState>(INITIAL_BATCH_STATE)
  const abortRef = useRef(false)

  const totals = useMemo<BatchTotals>(() => {
    return batchState.entries.reduce<BatchTotals>(
      (acc, entry) => {
        if (entry.status === 'already_imported') {
          acc.alreadyImported++
        } else if (entry.status === 'error') {
          acc.errors++
        } else if (entry.result) {
          acc.inserted += entry.result.inserted
          acc.duplicates += entry.result.duplicates
          acc.withinFileDuplicates += entry.result.withinFileDuplicates
          acc.pendingSkipped += entry.result.pendingSkipped
        }
        return acc
      },
      {
        inserted: 0,
        duplicates: 0,
        withinFileDuplicates: 0,
        pendingSkipped: 0,
        alreadyImported: 0,
        errors: 0,
      }
    )
  }, [batchState.entries])

  async function startBatch(files: File[], provider: Provider, userId: string): Promise<void> {
    abortRef.current = false

    const entries: FileImportEntry[] = files.map(f => ({
      file: f,
      relativePath: f.webkitRelativePath,
      status: 'pending',
      result: null,
      errorMessage: null,
    }))

    setBatchState({ phase: 'running', entries, currentIndex: 0 })

    const endpoint = provider === 'MAX' ? '/import/xlsx' : '/import/csv'

    for (let i = 0; i < files.length; i++) {
      if (abortRef.current) break

      const file = files[i] // eslint-disable-line security/detect-object-injection
      if (!file) continue

      setBatchState(prev => ({
        ...prev,
        currentIndex: i,
        entries: prev.entries.map((e, idx) => (idx === i ? { ...e, status: 'uploading' } : e)),
      }))

      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('provider', provider)
        formData.append('userId', userId)

        const res = await apiClient.post<ImportResult>(endpoint, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })

        setBatchState(prev => ({
          ...prev,
          entries: prev.entries.map((e, idx) =>
            idx === i ? { ...e, status: 'imported', result: res.data } : e
          ),
        }))
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 409) {
          setBatchState(prev => ({
            ...prev,
            entries: prev.entries.map((e, idx) =>
              idx === i ? { ...e, status: 'already_imported' } : e
            ),
          }))
        } else {
          const message = axios.isAxiosError(err)
            ? err.response?.status === 422
              ? 'הקובץ אינו מתאים לספק שנבחר'
              : 'שגיאת רשת — לא ניתן להעלות'
            : 'שגיאה לא ידועה'

          setBatchState(prev => ({
            ...prev,
            entries: prev.entries.map((e, idx) =>
              idx === i ? { ...e, status: 'error', errorMessage: message } : e
            ),
          }))
        }
      }
    }

    setBatchState(prev => ({
      ...prev,
      phase: abortRef.current ? 'aborted' : 'done',
      currentIndex: -1,
    }))
  }

  function abort(): void {
    abortRef.current = true
  }

  function reset(): void {
    abortRef.current = false
    setBatchState(INITIAL_BATCH_STATE)
  }

  return { batchState, startBatch, abort, reset, totals }
}
