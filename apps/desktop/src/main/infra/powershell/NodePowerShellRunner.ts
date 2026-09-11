import { app } from 'electron'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import type { PowerShellRunner } from '../../ports/powershell-runner'

const DEFAULT_TIMEOUT_MS = 25_000

function scriptPath(scriptName: string): string {
  const dir = app.isPackaged
    ? join(process.resourcesPath, 'powershell', 'scripts')
    : join(app.getAppPath(), 'resources', 'powershell', 'scripts')
  return join(dir, scriptName)
}

function argsFor(scriptName: string, params: Record<string, unknown> | undefined): string[] {
  const base = [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy',
    'Bypass',
    '-File',
    scriptPath(scriptName),
  ]
  if (params === undefined) return base
  return [...base, '-ParamsJson', JSON.stringify(params)]
}

export class NodePowerShellRunner implements PowerShellRunner {
  async runJson<T>(
    scriptName: string,
    params?: Record<string, unknown>,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    const text = await this.runRaw(scriptName, params, timeoutMs)
    return JSON.parse(text) as T
  }

  private runRaw(
    scriptName: string,
    params: Record<string, unknown> | undefined,
    timeoutMs: number,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const child = spawn('powershell.exe', argsFor(scriptName, params), { windowsHide: true })

      let out = ''
      let err = ''
      child.stdout?.on('data', (b: Buffer) => (out += b.toString('utf8')))
      child.stderr?.on('data', (b: Buffer) => (err += b.toString('utf8')))

      const giveUp = setTimeout(() => child.kill(), timeoutMs)

      child.on('error', (e) => {
        clearTimeout(giveUp)
        reject(e)
      })
      child.on('close', (code) => {
        clearTimeout(giveUp)
        if (code !== 0 && !out.trim()) {
          reject(new Error(`[powershell] ${scriptName} exited with ${code}: ${err.trim()}`))
          return
        }
        resolve(out.trim())
      })
    })
  }

  runNdjson<T>(
    scriptName: string,
    params: Record<string, unknown> | undefined,
    onEvent: (event: T) => void,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  ): { promise: Promise<{ code: number }>; kill(): void } {
    const child = spawn('powershell.exe', argsFor(scriptName, params), { windowsHide: true })

    let buffer = ''
    const consume = (chunk: string): void => {
      buffer += chunk
      for (;;) {
        const cut = buffer.indexOf('\n')
        if (cut < 0) break
        const line = buffer.slice(0, cut).trim()
        buffer = buffer.slice(cut + 1)
        if (!line) continue
        try {
          onEvent(JSON.parse(line) as T)
        } catch {
          continue
        }
      }
    }

    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', consume)
    child.stderr?.resume()

    const giveUp = setTimeout(() => child.kill(), timeoutMs)

    const promise = new Promise<{ code: number }>((resolve) => {
      child.on('error', () => {
        clearTimeout(giveUp)
        resolve({ code: -1 })
      })
      child.on('close', (code) => {
        clearTimeout(giveUp)
        if (buffer.trim()) consume('\n')
        resolve({ code: code ?? -1 })
      })
    })

    return { promise, kill: () => child.kill() }
  }
}
