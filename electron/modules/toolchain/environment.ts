import { textOr } from '@main/core/powershell'
import systemPathScript from './infrastructure/powershell/GetSystemPath.ps1?raw'

const PATH_TIMEOUT_MS = 60_000

let cachedPath: string | null = null

export function forgetPath(): void {
  cachedPath = null
}

export async function currentPath(): Promise<string> {
  if (cachedPath !== null) return cachedPath

  const fromRegistry = await textOr('', systemPathScript, { timeoutMs: PATH_TIMEOUT_MS })
  const seen = new Set<string>()
  const folders: string[] = []

  for (const part of [...(process.env['PATH'] ?? '').split(';'), ...fromRegistry.split(';')]) {
    const folder = part.trim().replace(/[\\/]+$/, '')
    if (!folder) continue
    const key = folder.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    folders.push(folder)
  }

  cachedPath = folders.join(';')
  return cachedPath
}

export async function toolEnv(): Promise<NodeJS.ProcessEnv> {
  const env: NodeJS.ProcessEnv = {}
  for (const [key, value] of Object.entries(process.env)) {
    if (!/^path$/i.test(key)) env[key] = value
  }
  env['PATH'] = await currentPath()
  return env
}
