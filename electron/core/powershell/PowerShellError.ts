export type PowerShellFailure = 'spawn' | 'timeout' | 'canceled' | 'overflow' | 'exit' | 'parse'

interface PowerShellErrorDetails {
  code?: number | null
  stderr?: string
  cause?: unknown
}

const SAID: Record<PowerShellFailure, string> = {
  spawn: 'não deu para iniciar o PowerShell',
  timeout: 'o PowerShell passou do tempo',
  canceled: 'o PowerShell foi cancelado',
  overflow: 'o PowerShell devolveu mais dados do que o limite',
  exit: 'o PowerShell terminou com erro',
  parse: 'o PowerShell devolveu algo que não é JSON',
}

export class PowerShellError extends Error {
  readonly failure: PowerShellFailure
  readonly code: number | null
  readonly stderr: string

  constructor(failure: PowerShellFailure, details: PowerShellErrorDetails = {}) {
    const stderr = details.stderr?.trim() ?? ''
    super(stderr ? `${SAID[failure]}: ${stderr}` : SAID[failure], { cause: details.cause })
    this.name = 'PowerShellError'
    this.failure = failure
    this.code = details.code ?? null
    this.stderr = stderr
  }
}

export function isPowerShellError(value: unknown): value is PowerShellError {
  return value instanceof PowerShellError
}
