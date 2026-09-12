import type { Catalog } from '@pulse/domain'
import { entryMatchesProgram } from '@pulse/utils'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { AutostartEntry, AutostartReader } from '../../ports/autostart-reader'

const SCRIPT_TIMEOUT_MS = 25_000
const REUSE_MS = 120_000

interface RawEntry {
  name: string
  value: string
  enabled: boolean
}

export class WindowsAutostartReader implements AutostartReader {
  private cached: { at: number; entries: AutostartEntry[] } | null = null

  constructor(
    private readonly catalog: Catalog,
    private readonly powershell: PowerShellRunner,
  ) {}

  async list(): Promise<AutostartEntry[]> {
    if (this.cached && Date.now() - this.cached.at < REUSE_MS) return this.cached.entries

    const raw = await this.powershell
      .runJson<{ entries: RawEntry[] }>('Get-Autostart.ps1', undefined, SCRIPT_TIMEOUT_MS)
      .catch(() => ({ entries: [] }))

    const found = new Map<string, 'on' | 'off'>()
    for (const program of this.catalog.programs) {
      for (const entry of raw.entries) {
        if (!entry?.name) continue
        if (!entryMatchesProgram(entry.name, entry.value ?? '', program)) continue
        if (entry.enabled || !found.has(program.id)) {
          found.set(program.id, entry.enabled ? 'on' : 'off')
        }
        if (entry.enabled) break
      }
    }

    const entries = [...found.entries()].map(([id, state]) => ({ id, state }))
    this.cached = { at: Date.now(), entries }
    return entries
  }
}
