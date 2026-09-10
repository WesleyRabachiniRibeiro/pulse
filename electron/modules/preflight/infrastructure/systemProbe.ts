import { json, stream } from '@main/core/powershell'
import type { Drive } from '@shared/domain/preflight'
import drivesScript from './powershell/GetDrives.ps1?raw'
import systemFactsScript from './powershell/GetSystemFacts.ps1?raw'

const PROBE_TIMEOUT_MS = 25_000
const NO_DRIVES = 'Nao foi possivel listar os discos deste computador.'

export interface SystemFacts {
  product: string
  version: string
  build: number
  revision: number
  admin: boolean
  winget: string | null
  hypervisor: boolean
  virtFirmware: boolean
}

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

export function readSystemFacts(): Promise<SystemFacts> {
  return json<SystemFacts>(systemFactsScript, {
    timeoutMs: PROBE_TIMEOUT_MS,
    maxBuffer: 4 * 1024 * 1024,
  })
}

export function readDrives(onEnriched?: (drives: Drive[]) => void): Promise<Drive[]> {
  return new Promise((resolve, reject) => {
    let first = true

    const take = (line: string): void => {
      const clean = line.trim()
      if (!clean) return

      let parsed: unknown
      try {
        parsed = JSON.parse(clean)
      } catch {
        return
      }

      const drives = asArray(parsed as Drive | Drive[])
      if (first) {
        first = false
        resolve(drives)
        return
      }
      onEnriched?.(drives)
    }

    stream(drivesScript, { onLine: take, timeoutMs: PROBE_TIMEOUT_MS })
      .then(() => {
        if (first) reject(new Error(NO_DRIVES))
      })
      .catch(() => {
        if (first) reject(new Error(NO_DRIVES))
      })
  })
}
