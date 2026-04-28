export interface ImportResult {
  inserted: number
  skipped: number
  errors: string[]
}

export interface ImportCsvInput {
  csv: string
  filename: string
  accountId: string
  userId: string
}

export class ImportError extends Error {
  constructor(public readonly code: string) {
    super(code)
    this.name = 'ImportError'
  }
}

export class ImportService {
  detectFormat(_csv: string): 'max' | 'cal' | null {
    throw new Error('not implemented')
  }

  async importCsv(_input: ImportCsvInput): Promise<ImportResult> {
    throw new Error('not implemented')
  }
}
