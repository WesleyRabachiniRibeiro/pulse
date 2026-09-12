import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { editorFolderFor, mergeEditorSettings } from '@pulse/domain'
import type { EditorSettingsStore, EditorWriteResult } from '../../ports/editor-settings-store'

export class JsonEditorSettingsStore implements EditorSettingsStore {
  async apply(programId: string, tweakIds: readonly string[]): Promise<EditorWriteResult> {
    if (tweakIds.length === 0) return 'nothing'

    const path = this.settingsFile(programId)
    if (!path) return 'failed'

    const current = await this.readCurrent(path)
    if (current === null) return 'unreadable'

    try {
      await mkdir(dirname(path), { recursive: true })
      const next = mergeEditorSettings(current, tweakIds)
      await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
      return 'written'
    } catch {
      return 'failed'
    }
  }

  private settingsFile(programId: string): string | null {
    const folder = editorFolderFor(programId)
    const roaming = process.env['APPDATA']
    if (!folder || !roaming) return null
    return join(roaming, folder, 'User', 'settings.json')
  }

  // Arquivo ausente ou vazio é um começo válido. Já um arquivo que existe e
  // não decodifica devolve null, para o chamador não sobrescrever.
  private async readCurrent(path: string): Promise<Record<string, unknown> | null> {
    const raw = await readFile(path, 'utf8').catch(() => null)
    if (raw === null || !raw.trim()) return {}

    try {
      const parsed: unknown = JSON.parse(raw)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
      return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }
}
