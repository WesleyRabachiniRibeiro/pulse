import {
  FORMAT_FILE,
  readPortable,
  type Catalog,
  type ExportFormat,
  type ImportMode,
  type Profile,
} from '@pulse/domain'
import { cleanProfile, fileFor, missingFrom, profileOf } from '@pulse/utils'
import type { FileDialog } from '../../ports/file-dialog'
import type { SyncFolder, SyncFolders } from '../../ports/sync-folders'
import type { RemoteFetch } from '../../ports/remote-fetch'

export interface ExportResult {
  status: 'saved' | 'canceled' | 'failed'
  path?: string
}

export interface ImportResult {
  status: 'imported' | 'canceled' | 'failed' | 'invalid'
  profile?: Profile
  count?: number
  missing?: string[]
}

export class ProfileService {
  constructor(
    private readonly catalog: Catalog,
    private readonly dialog: FileDialog,
    private readonly remote: RemoteFetch,
    private readonly folders: SyncFolders,
    private readonly startIn: () => Promise<string | undefined>,
  ) {}

  listFolders(): Promise<readonly SyncFolder[]> {
    return this.folders.list()
  }

  pickFolder(): Promise<string | null> {
    return this.dialog.pickFolder()
  }

  async export(format: ExportFormat, profile: Profile, drive?: string): Promise<ExportResult> {
    const file = FORMAT_FILE[format]
    const folder = await this.startIn()
    const { outcome, path } = await this.dialog.save({
      suggestedName: this.suggestedName(format),
      filterName: file.name,
      extension: file.extension,
      contents: fileFor(this.catalog, format, profile, drive),
      ...(folder ? { startIn: folder } : {}),
    })

    return outcome === 'saved' ? { status: 'saved', ...(path ? { path } : {}) } : { status: outcome }
  }

  async import(mode: ImportMode, current: Profile): Promise<ImportResult> {
    const opened = await this.dialog.openText(
      FORMAT_FILE.pulse.name,
      ['json'],
      await this.startIn(),
    )
    if (!opened) return { status: 'canceled' }

    return this.adopt(opened.contents, mode, current)
  }

  async importLink(url: string, mode: ImportMode, current: Profile): Promise<ImportResult> {
    const body = await this.remote.text(url)
    if (body === null) return { status: 'failed' }

    return this.adopt(body, mode, current)
  }

  // O que veio de fora é limpo contra o catálogo daqui antes de virar perfil, e
  // o que sobrou de fora é devolvido para a tela poder dizer o que faltou.
  private adopt(raw: string, mode: ImportMode, current: Profile): ImportResult {
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      return { status: 'invalid' }
    }

    const portable = readPortable(parsed)
    if (!portable) return { status: 'invalid' }

    const known = (id: string): boolean => this.catalog.byId.has(id)
    const wanted = profileOf(portable, mode, current)
    const profile = cleanProfile(wanted, known)

    return {
      status: 'imported',
      profile,
      count: profile.selected.length,
      missing: missingFrom(wanted, known),
    }
  }

  private suggestedName(format: ExportFormat): string {
    const day = new Date().toISOString().slice(0, 10)
    return format === 'pulse' ? `pulse-${day}` : `pulse-${format}-${day}`
  }
}
