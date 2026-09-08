import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { editorFolderFor, mergeEditorSettings } from '@shared/domain/editor'

export type EditorResult = 'written' | 'nothing' | 'unreadable' | 'failed'

function settingsFile(programId: string): string | null {
  const folder = editorFolderFor(programId)
  const roaming = process.env['APPDATA']
  if (!folder || !roaming) return null
  return join(roaming, folder, 'User', 'settings.json')
}

async function readCurrent(path: string): Promise<Record<string, unknown> | null> {
  const raw = await readFile(path, 'utf8').catch(() => null)
  if (raw === null) return {}
  if (!raw.trim()) return {}

  try {
    const parsed: unknown = JSON.parse(raw)
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

export async function applyEditorTweaks(
  programId: string,
  ids: readonly string[],
): Promise<EditorResult> {
  if (ids.length === 0) return 'nothing'

  const path = settingsFile(programId)
  if (!path) return 'failed'

  const current = await readCurrent(path)
  if (current === null) return 'unreadable'

  const next = mergeEditorSettings(current, ids)

  try {
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
    return 'written'
  } catch {
    return 'failed'
  }
}

export function editorSettingsPath(programId: string): string | null {
  return settingsFile(programId)
}
