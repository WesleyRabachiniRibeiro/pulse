export interface PowerShellOptions {
  timeoutMs?: number
  maxBuffer?: number
  signal?: AbortSignal
}

export interface PowerShellStreamOptions extends PowerShellOptions {
  onLine: (line: string) => void
}

export interface PowerShellResult {
  stdout: string
  stderr: string
  code: number
}
