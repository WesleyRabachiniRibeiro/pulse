import { type CatalogState, type PackageVersion, type InstalledTree, type StartupEntry, type Upgrade } from '@pulse/domain'
import { buildInstalled, compareVersions, readCatalogPayload } from '@pulse/utils'
import type { ProcessRunner } from '../../ports/process-runner'
import type { CatalogPackageReader } from '../../ports/catalog-package-reader'
import type { AutostartEntry, AutostartReader } from '../../ports/autostart-reader'
import type { StartupEntries } from '../../ports/startup-entries'
import type { RegistryReader } from '../../ports/registry-reader'
import type { CatalogCache } from '../../ports/catalog-cache'
import type { RemoteFetch } from '../../ports/remote-fetch'
import type { LiveCatalog } from './LiveCatalog'

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export class CatalogService {
  constructor(
    private readonly catalog: LiveCatalog,
    private readonly packageReader: CatalogPackageReader,
    private readonly autostartReader: AutostartReader,
    private readonly processRunner: ProcessRunner,
    private readonly startupEntries: StartupEntries,
    private readonly registryReader: RegistryReader,
    private readonly cache: CatalogCache,
    private readonly remote: RemoteFetch,
    private readonly sourceUrl: string,
  ) {}

  private state: CatalogState = { source: 'seed', checkedAt: null, loading: false }
  private readonly listeners = new Set<(state: CatalogState) => void>()

  subscribe(listener: (state: CatalogState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  currentState(): CatalogState {
    return { ...this.state }
  }

  // O cache entra primeiro, para a tela abrir com o catálogo mais recente que
  // já se conhece em vez de esperar a rede. Depois a rede tenta por cima.
  async load(): Promise<void> {
    if (this.state.loading) return
    this.announce({ ...this.state, loading: true })

    const cached = await this.cache.read()
    if (cached) {
      this.catalog.adopt(cached)
      this.announce({ source: 'cache', checkedAt: this.state.checkedAt, loading: true })
    }

    const body = await this.remote.text(this.sourceUrl)
    const fresh = body === null ? null : readCatalogPayload(safeJson(body))

    if (fresh) {
      this.catalog.adopt(fresh)
      await this.cache.write(fresh)
      this.announce({ source: 'network', checkedAt: new Date().toISOString(), loading: false })
      return
    }

    // Rede fora, ou resposta que não passa na validação: fica o que já havia.
    this.announce({ ...this.state, loading: false })
  }

  retry(): Promise<void> {
    return this.load()
  }

  private announce(state: CatalogState): void {
    this.state = state
    for (const listener of this.listeners) listener({ ...state })
  }

  listInstalled(fresh: boolean): Promise<string[]> {
    return this.packageReader.listInstalled(fresh)
  }

  // O winget devolve o identificador dele. Casar com o catálogo é o que deixa
  // a tela mostrar ícone e nome do Pulse em vez de "Google.Chrome".
  async listUpgrades(): Promise<Upgrade[]> {
    const found = await this.packageReader.listUpgrades()
    const byWinget = new Map(
      this.catalog.programs.filter((p) => p.winget).map((p) => [p.winget?.toLowerCase(), p.id]),
    )

    return found.map((one) => {
      const programId = byWinget.get(one.wingetId.toLowerCase())
      return programId ? { ...one, programId } : { ...one }
    })
  }

  // O que o winget gerencia vira o que dá para desinstalar pelo Pulse. O resto
  // aparece na lista mesmo assim, porque saber o que está no PC é o ponto.
  async listInstalledTree(): Promise<InstalledTree> {
    const [entries, managed] = await Promise.all([
      this.registryReader.listEntries(),
      this.packageReader.listInstalled().catch((): string[] => []),
    ])

    const wingetIds = managed
      .map((id) => this.catalog.byId.get(id)?.winget)
      .filter((id): id is string => Boolean(id))

    return buildInstalled(entries, this.catalog.programs, wingetIds)
  }

  listStartup(): Promise<readonly StartupEntry[]> {
    return this.startupEntries.list()
  }

  async setStartup(name: string, on: boolean): Promise<readonly StartupEntry[]> {
    await this.startupEntries.set(name, on)
    return this.startupEntries.list()
  }

  listAutostart(): Promise<AutostartEntry[]> {
    return this.autostartReader.list()
  }

  async listVersions(id: string): Promise<PackageVersion[]> {
    const program = this.catalog.byId.get(id)
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
