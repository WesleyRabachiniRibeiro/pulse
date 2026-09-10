import { spawn } from 'node:child_process'
import { PowerShellError, type PowerShellFailure } from './PowerShellError'
import type {
  PowerShellOptions,
  PowerShellResult,
  PowerShellStreamOptions,
} from './PowerShellRunner.types'

const EXECUTABLE = 'powershell.exe'
const FLAGS = ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand']

export const DEFAULT_TIMEOUT_MS = 25_000
export const DEFAULT_MAX_BUFFER = 8 * 1024 * 1024

function encode(script: string): string {
  return Buffer.from(script, 'utf16le').toString('base64')
}

function execute(
  script: string,
  options: PowerShellOptions,
  onLine?: (line: string) => void,
): Promise<PowerShellResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const maxBuffer = options.maxBuffer ?? DEFAULT_MAX_BUFFER

  return new Promise((resolve, reject) => {
    const child = spawn(EXECUTABLE, [...FLAGS, encode(script)], { windowsHide: true })

    let stdout = ''
    let stderr = ''
    let pending = ''
    let settled = false

    const stop = (): void => {
      clearTimeout(timer)
      options.signal?.removeEventListener('abort', onAbort)
      child.kill()
    }

    const fail = (failure: PowerShellFailure, cause?: unknown): void => {
      if (settled) return
      settled = true
      stop()
      reject(new PowerShellError(failure, { stderr, cause }))
    }

    const timer = setTimeout(() => fail('timeout'), timeoutMs)
    const onAbort = (): void => fail('canceled')

    if (options.signal?.aborted) {
      fail('canceled')
      return
    }
    options.signal?.addEventListener('abort', onAbort, { once: true })

    child.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8')
      stdout += text
      if (stdout.length > maxBuffer) {
        fail('overflow')
        return
      }
      if (!onLine) return
      pending += text
      let breakAt = pending.indexOf('\n')
      while (breakAt !== -1) {
        onLine(pending.slice(0, breakAt))
        pending = pending.slice(breakAt + 1)
        breakAt = pending.indexOf('\n')
      }
    })

    child.stderr?.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })

    child.on('error', (error) => fail('spawn', error))

    child.on('close', (code) => {
      if (settled) return
      settled = true
      stop()
      if (onLine && pending.trim()) onLine(pending)
      resolve({ stdout, stderr, code: code ?? 0 })
    })
  })
}

export function run(script: string, options: PowerShellOptions = {}): Promise<PowerShellResult> {
  return execute(script, options)
}

export async function text(script: string, options: PowerShellOptions = {}): Promise<string> {
  const result = await execute(script, options)
  if (result.code !== 0) {
    throw new PowerShellError('exit', { code: result.code, stderr: result.stderr })
  }
  return result.stdout.trim()
}

export async function json<T>(script: string, options: PowerShellOptions = {}): Promise<T> {
  const raw = await text(script, options)
  try {
    return JSON.parse(raw) as T
  } catch (error) {
    throw new PowerShellError('parse', { stderr: raw.slice(0, 200), cause: error })
  }
}

export function stream(script: string, options: PowerShellStreamOptions): Promise<PowerShellResult> {
  const { onLine, ...rest } = options
  return execute(script, rest, onLine)
}

export async function textOr(
  fallback: string,
  script: string,
  options: PowerShellOptions = {},
): Promise<string> {
  return text(script, options).catch(() => fallback)
}

export async function jsonOr<T>(
  fallback: T,
  script: string,
  options: PowerShellOptions = {},
): Promise<T> {
  return json<T>(script, options).catch(() => fallback)
}
