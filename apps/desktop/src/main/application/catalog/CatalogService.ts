import { compareVersions, PROGRAM_BY_ID, type PackageVersion } from '@pulse/domain'
import type { ProcessRunner } from '../../ports/process-runner'
import type { CatalogPackageReader } from '../../ports/catalog-package-reader'
import type { AutostartEntry, AutostartReader } from '../../ports/autostart-reader'

export class CatalogService {
  constructor(
    private readonly packageReader: CatalogPackageReader,
    private readonly autostartReader: AutostartReader,
    private readonly processRunner: ProcessRunner,
  ) {}

  listInstalled(fresh: boolean): Promise<string[]> {
    return this.packageReader.listInstalled(fresh)
  }

  listAutostart(): Promise<AutostartEntry[]> {
    return this.autostartReader.list()
  }

  async listVersions(id: string): Promise<PackageVersion[]> {
    const program = PROGRAM_BY_ID.get(id)
    if (!program?.family) return []

    const { prefix, pattern } = program.family
    const accepted = new RegExp(pattern)

    const { text } = await this.processRunner
      .runOnce('winget', ['search', prefix, '--disable-interactivity', '--source', 'winget'])
      .catch((): { code: number; text: string } => ({ code: -1, text: '' }))

    // O winget não tem uma saída estruturada para "search" com --source winget
    // em todas as versões (só --output json em builds recentes), então a
    // tabela de texto ainda precisa ser lida coluna a coluna aqui.
    const versions: PackageVersion[] = []
    for (const line of text.split(/\r?\n/)) {
      const tokens = line.trim().split(/\s+/)
      const position = tokens.findIndex((t) => accepted.test(t))
      if (position <= 0) continue

      const winget = tokens[position]
      const version = tokens[position + 1]
      const name = tokens.slice(0, position).join(' ')
      if (!winget || !version || !name) continue

      versions.push({ winget, name, version, recommended: winget === program.winget })
    }

    return versions.sort((a, b) => compareVersions(b, a))
  }
}
