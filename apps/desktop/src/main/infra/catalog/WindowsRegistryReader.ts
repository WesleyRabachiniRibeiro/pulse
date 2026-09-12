import type { RegistryEntry } from '@pulse/domain'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { RegistryReader } from '../../ports/registry-reader'

const SCRIPT_TIMEOUT_MS = 30_000
const REUSE_MS = 60_000

export class WindowsRegistryReader implements RegistryReader {
  private cached: { at: number; entries: readonly RegistryEntry[] } | null = null

  constructor(private readonly powershell: PowerShellRunner) {}

  async listEntries(): Promise<readonly RegistryEntry[]> {
    if (this.cached && Date.now() - this.cached.at < REUSE_MS) return this.cached.entries

    const raw = await this.powershell
      .runJson<{ entries: RegistryEntry[] }>('Get-RegistryEntries.ps1', undefined, SCRIPT_TIMEOUT_MS)
      .catch(() => ({ entries: [] }))

    const entries = raw.entries ?? []
    this.cached = { at: Date.now(), entries }
    return entries
  }
}
