import type { Catalog, Upgrade } from '@pulse/domain'
import { installedIds, nameMatchesProgram, readUpgrades } from '@pulse/utils'
import type { PowerShellRunner } from '../../ports/powershell-runner'
import type { PackageRepository } from '../../ports/package-repository'
import type { CatalogPackageReader } from '../../ports/catalog-package-reader'
import type { ProcessRunner } from '../../ports/process-runner'

const SCRIPT_TIMEOUT_MS = 25_000
const REUSE_MS = 120_000

interface UninstallEntry {
  name: string
  quiet: string
  plain: string
}

const MSI_CODE = /\{[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}\}/

function silentCommand(entry: UninstallEntry): string | null {
  if (entry.quiet?.trim()) return entry.quiet.trim()

  const plain = entry.plain ?? ''
  if (!/msiexec/i.test(plain)) return null

  const code = MSI_CODE.exec(plain)?.[0]
  return code ? `msiexec.exe /x ${code} /quiet /norestart` : null
}

// Espelha a fila: depois de instalar/desinstalar/reter, forgetCache() bumpa
// esta geração para descartar leituras já em voo e forçar a próxima a ir de
// novo ao registro, sem que duas chamadas concorrentes disparem PowerShell
// em duplicado (a leitura em andamento é reaproveitada por quem chegar depois).
export class WingetPackageRepository implements PackageRepository, CatalogPackageReader {
  private generation = 0
  private cached: { at: number; ids: string[] } | null = null
  private inFlight: { generation: number; reading: Promise<string[]> } | null = null

  constructor(
    private readonly catalog: Catalog,
    private readonly powershell: PowerShellRunner,
    private readonly processRunner: ProcessRunner,
  ) {}

  // Sempre lê "fresco" (sem a janela de reuso de listInstalled), só dedupe
  // por chamadas concorrentes — a fila usa isInstalled() em polling durante a
  // desinstalação (disappeared()) e precisa enxergar a mudança assim que sai
  // do registro, não o valor de até 120s atrás.
  async isInstalled(id: string): Promise<boolean> {
    const ids = await this.readInstalled().catch((): string[] => [])
    return ids.includes(id)
  }

  // `winget upgrade` não aceita --output json: a saída estruturada existe só
  // para consulta de catálogo, não para esta. Por isso a leitura é de texto, e
  // a heurística mora em readUpgrades.
  async listUpgrades(): Promise<readonly Upgrade[]> {
    const { text } = await this.processRunner.runOnce('winget', [
      'upgrade',
      '--accept-source-agreements',
      '--disable-interactivity',
    ])

    const known = this.catalog.programs.map((program) => program.winget).filter((id): id is string => Boolean(id))
    return readUpgrades(text, known)
  }

  async listInstalled(fresh = false): Promise<string[]> {
    if (!fresh && this.cached && Date.now() - this.cached.at < REUSE_MS) {
      return this.cached.ids
    }
    return this.readInstalled()
  }

  async quietUninstallCommands(id: string): Promise<string[]> {
    const program = this.catalog.byId.get(id)
    if (!program) return []

    const { entries } = await this.powershell
      .runJson<{ entries: UninstallEntry[] }>('Get-UninstallEntries.ps1', undefined, SCRIPT_TIMEOUT_MS)
      .catch(() => ({ entries: [] }))

    const commands: string[] = []
    for (const entry of entries) {
      if (!entry?.name || !nameMatchesProgram(entry.name, program)) continue
      const command = silentCommand(entry)
      if (command && !commands.includes(command)) commands.push(command)
    }
    return commands
  }

  forgetCache(): void {
    this.generation++
    this.cached = null
  }

  private readInstalled(): Promise<string[]> {
    if (this.inFlight?.generation === this.generation) return this.inFlight.reading

    const mine = this.generation
    const reading = this.readInstalledNames()
      .then((ids) => {
        if (mine === this.generation) this.cached = { at: Date.now(), ids }
        return ids
      })
      .finally(() => {
        if (this.inFlight?.reading === reading) this.inFlight = null
      })

    this.inFlight = { generation: mine, reading }
    return reading
  }

  private async readInstalledNames(): Promise<string[]> {
    const { names } = await this.powershell.runJson<{ names: string[] }>(
      'Get-InstalledPrograms.ps1',
      undefined,
      SCRIPT_TIMEOUT_MS,
    )
    return installedIds(this.catalog, names.filter((n): n is string => typeof n === 'string'))
  }
}
