import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { locateVsCode } from './locate'

const exec = promisify(execFile)

const CALL_TIMEOUT_MS = 20_000
const LIMIT = 200

export async function listVsCodeExtensions(): Promise<string[]> {
  const code = await locateVsCode().catch(() => null)
  if (!code) return []

  const { stdout } = await exec(code, ['--list-extensions'], {
    windowsHide: true,
    timeout: CALL_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  }).catch(() => ({ stdout: '' }))

  const found: string[] = []

  for (const line of stdout.split(/\r?\n/)) {
    const id = line.trim()
    if (!id || !id.includes('.') || /\s/.test(id)) continue
    if (!found.includes(id)) found.push(id)
    if (found.length >= LIMIT) break
  }

  return found.sort()
}
