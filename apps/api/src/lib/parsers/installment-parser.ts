export interface InstallmentInfo {
  num: number
  of: number
}

const INSTALLMENT_RE = /תשלום\s+(\d+)\s+מתוך\s+(\d+)/

export function parseInstallmentNote(note: string): InstallmentInfo | null {
  const match = INSTALLMENT_RE.exec(note.trim())
  if (!match) return null

  const num = parseInt(match[1] as string, 10)
  const of_ = parseInt(match[2] as string, 10)

  if (num <= 0 || of_ <= 0 || num > of_) return null

  return { num, of: of_ }
}
