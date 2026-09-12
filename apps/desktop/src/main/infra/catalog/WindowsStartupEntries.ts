import type { StartupEntry } from '@pulse/domain'
import { tidyStartup, withPrograms } from '@pulse/utils'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { StartupEntries } from '../../ports/startup-entries'

const SCRIPT_TIMEOUT_MS = 25_000

interface RawEntry {
  name: string
  value: string
  enabled: boolean
}

export class WindowsStartupEntries implements StartupEntries {
  constructor(private readonly powershell: PowerShellRunner) {}

  async list(): Promise<readonly StartupEntry[]> {
    const raw = await this.powershell
      .runJson<{ entries: RawEntry[] }>('Get-Autostart.ps1', undefined, SCRIPT_TIMEOUT_MS)
      .catch(() => ({ entries: [] }))

    const entries = raw.entries
      .filter((entry) => entry?.name)
      .map((entry) => ({
        name: entry.name,
        value: entry.value ?? '',
        enabled: entry.enabled,
      }))

    return tidyStartup(withPrograms(entries))
  }

  async set(name: string, on: boolean): Promise<void> {
    await this.powershell
      .runJson<{ ok: boolean }>('Set-StartupEntry.ps1', { name, turnOn: on }, SCRIPT_TIMEOUT_MS)
      .catch(() => undefined)
  }
}
