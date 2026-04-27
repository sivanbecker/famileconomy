export interface InstallmentInfo {
  num: number
  of: number
}

export function parseInstallmentNote(_note: string): InstallmentInfo | null {
  throw new Error('not implemented')
}
