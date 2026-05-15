import { describe, it, expect } from 'vitest'
import { filterFilesForFolder } from '../hooks/use-batch-import'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFile(relativePath: string): File {
  const name = relativePath.split('/').pop() ?? relativePath
  const file = new File(['content'], name)
  Object.defineProperty(file, 'webkitRelativePath', { value: relativePath })
  return file
}

function makeFileList(files: File[]): FileList {
  const list = {
    length: files.length,
    item: (i: number) => files[i] ?? null, // eslint-disable-line security/detect-object-injection
  }
  files.forEach((f, i) => {
    Object.defineProperty(list, i, { value: f })
  })
  return list as unknown as FileList
}

// ─── MAX tests ────────────────────────────────────────────────────────────────

describe('filterFilesForFolder — MAX', () => {
  it('returns xlsx files at depth 1', () => {
    const files = [makeFile('2025/max_jan.xlsx'), makeFile('2025/max_feb.xlsx')]
    const result = filterFilesForFolder(makeFileList(files), 'MAX')
    expect(result).toHaveLength(2)
  })

  it('returns xlsm files at depth 1', () => {
    const files = [makeFile('2025/max_jan.xlsm')]
    const result = filterFilesForFolder(makeFileList(files), 'MAX')
    expect(result).toHaveLength(1)
  })

  it('excludes csv files for MAX', () => {
    const files = [makeFile('2025/max_jan.csv')]
    const result = filterFilesForFolder(makeFileList(files), 'MAX')
    expect(result).toHaveLength(0)
  })

  it('excludes xlsx files at depth 2 (subfolders) for MAX', () => {
    const files = [makeFile('2025/jan/max_jan.xlsx')]
    const result = filterFilesForFolder(makeFileList(files), 'MAX')
    expect(result).toHaveLength(0)
  })

  it('excludes files with no extension', () => {
    const files = [makeFile('2025/somefile')]
    const result = filterFilesForFolder(makeFileList(files), 'MAX')
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty FileList', () => {
    const result = filterFilesForFolder(makeFileList([]), 'MAX')
    expect(result).toHaveLength(0)
  })

  it('sorts results by relativePath alphabetically', () => {
    const files = [makeFile('2025/max_feb.xlsx'), makeFile('2025/max_jan.xlsx')]
    const result = filterFilesForFolder(makeFileList(files), 'MAX')
    // 'feb' < 'jan' alphabetically
    expect(result[0]?.name).toBe('max_feb.xlsx')
    expect(result[1]?.name).toBe('max_jan.xlsx')
  })
})

// ─── CAL tests ────────────────────────────────────────────────────────────────

describe('filterFilesForFolder — CAL', () => {
  it('returns csv files at depth 1 (flat structure)', () => {
    const files = [makeFile('2025/cal_jan.csv'), makeFile('2025/cal_feb.csv')]
    const result = filterFilesForFolder(makeFileList(files), 'CAL')
    expect(result).toHaveLength(2)
  })

  it('returns csv files at depth 2 (month subfolders)', () => {
    const files = [
      makeFile('2025/jan/cal_01.csv'),
      makeFile('2025/jan/cal_02.csv'),
      makeFile('2025/feb/cal_01.csv'),
    ]
    const result = filterFilesForFolder(makeFileList(files), 'CAL')
    expect(result).toHaveLength(3)
  })

  it('returns mix of depth 1 and depth 2 csvs', () => {
    const files = [makeFile('2025/cal_root.csv'), makeFile('2025/jan/cal_sub.csv')]
    const result = filterFilesForFolder(makeFileList(files), 'CAL')
    expect(result).toHaveLength(2)
  })

  it('excludes csv files at depth 3 (too deeply nested)', () => {
    const files = [makeFile('2025/jan/week1/cal_deep.csv')]
    const result = filterFilesForFolder(makeFileList(files), 'CAL')
    expect(result).toHaveLength(0)
  })

  it('excludes xlsx files for CAL', () => {
    const files = [makeFile('2025/jan/cal.xlsx')]
    const result = filterFilesForFolder(makeFileList(files), 'CAL')
    expect(result).toHaveLength(0)
  })

  it('excludes files with empty webkitRelativePath (depth 0)', () => {
    // makeFile('') sets webkitRelativePath to '' — depth = 0, filtered out
    const file = makeFile('')
    const result = filterFilesForFolder(makeFileList([file]), 'CAL')
    expect(result).toHaveLength(0)
  })

  it('sorts results by relativePath alphabetically', () => {
    const files = [
      makeFile('2025/feb/cal_01.csv'),
      makeFile('2025/jan/cal_02.csv'),
      makeFile('2025/jan/cal_01.csv'),
    ]
    const result = filterFilesForFolder(makeFileList(files), 'CAL')
    // 'feb' < 'jan' alphabetically, then jan/cal_01 < jan/cal_02
    expect(result[0]?.webkitRelativePath).toBe('2025/feb/cal_01.csv')
    expect(result[1]?.webkitRelativePath).toBe('2025/jan/cal_01.csv')
    expect(result[2]?.webkitRelativePath).toBe('2025/jan/cal_02.csv')
  })
})
