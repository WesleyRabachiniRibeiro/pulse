import type { Drive } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { DiskSpaceProbe } from '../../ports/disk-space-probe'
import type { DriveLister } from '../../ports/drive-lister'

const SCRIPT_TIMEOUT_MS = 25_000

function asArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value]
}

function sortDrives(drives: Drive[]): Drive[] {
  return [...drives].sort((a, b) => {
    if (a.system !== b.system) return a.system ? -1 : 1
    return b.freeBytes - a.freeBytes
  })
}

export class WindowsDiskSpaceProbe implements DiskSpaceProbe, DriveLister {
  constructor(private readonly powershell: PowerShellRunner) {}

  listDrives(onEnriched?: (drives: Drive[]) => void): Promise<Drive[]> {
    return new Promise((resolve, reject) => {
      let settled = false

      const { promise } = this.powershell.runNdjson<Drive | Drive[]>(
        'Get-Drives.ps1',
        undefined,
        (event) => {
          const drives = sortDrives(asArray(event))
          if (!settled) {
            settled = true
            resolve(drives)
            return
          }
          onEnriched?.(drives)
        },
        SCRIPT_TIMEOUT_MS,
      )

      void promise.then(() => {
        if (!settled) reject(new Error('Não foi possível listar os discos deste computador.'))
      })
    })
  }
}
