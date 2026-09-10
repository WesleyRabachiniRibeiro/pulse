import { BrowserWindow, dialog } from 'electron'
import { readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { access } from 'node:fs/promises'
import { hasProgram } from '@shared/domain/catalog'
import { addToCatalog, myPrograms } from '../catalog'
import { installedIdsNow } from '../catalog'
import { cleanProfile, EMPTY_PROFILE, type Profile } from '@shared/domain/profile'
import {
  fileFor,
  FORMAT_FILE,
  profileOf,
  readPortable,
  unknownOf,
  withVsCode,
  type ExportFormat,
  type ImportMode,
} from '@shared/domain/portable'
import { readProfile, writeProfile } from './profile.service'
import { listVsCodeExtensions } from './vscode.service'
import { readPreferences } from './preferences.service'

const FETCH_TIMEOUT_MS = 10_000

export interface ExportResult {
  status: 'saved' | 'canceled' | 'failed'
  path?: string
}

export interface ImportResult {
  status: 'imported' | 'canceled' | 'failed' | 'invalid'
  count?: number
  adopted?: number
  missing?: string[]
}

function owner(): BrowserWindow | null {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
}

function stamp(): string {
  const now = new Date()
  const pad = (value: number): string => String(value).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

async function folderOrHome(): Promise<string> {
  const prefs = await readPreferences()
  const chosen = prefs.profileFolder

  if (chosen) {
    try {
      await access(chosen)
      return chosen
    } catch {}
  }

  return join(homedir(), 'Documents')
}

export async function exportProfile(
  format: ExportFormat,
  ids?: readonly string[],
): Promise<ExportResult> {
  const window = owner()
  if (!window) return { status: 'failed' }

  const file = FORMAT_FILE[format]
  const folder = await folderOrHome()

  const chosen = await dialog.showSaveDialog(window, {
    title: 'Salvar o perfil',
    defaultPath: join(folder, `pulse-${stamp()}.${file.extension}`),
    filters: [{ name: file.name, extensions: [file.extension] }],
  })

  if (chosen.canceled || !chosen.filePath) return { status: 'canceled' }

  const saved = await readProfile()
  const profile: Profile = ids ? { ...saved, selected: [...ids] } : saved
  const prefs = await readPreferences()

  try {
    const vscode = format === 'pulse' ? await listVsCodeExtensions().catch(() => []) : []

    await writeFile(
      chosen.filePath,
      fileFor(format, profile, prefs.drive, { extras: myPrograms(), vscode }),
      'utf8',
    )
    return { status: 'saved', path: chosen.filePath }
  } catch {
    return { status: 'failed' }
  }
}

async function adopt(raw: unknown, mode: ImportMode): Promise<ImportResult> {
  const portable = readPortable(raw)
  if (!portable) return { status: 'invalid' }

  let adopted = 0
  for (const program of unknownOf(portable, hasProgram)) {
    if ((await addToCatalog(program).catch(() => 'exists')) === 'added') adopted++
  }

  const current = await readProfile().catch(() => EMPTY_PROFILE)
  const trazido = withVsCode(profileOf(portable, mode, current), portable, mode)
  const merged = cleanProfile(trazido, hasProgram)

  await writeProfile(merged)

  const here = await installedIdsNow().catch((): string[] => [])
  const missing = merged.selected.filter((id) => !here.includes(id))

  return { status: 'imported', count: merged.selected.length, adopted, missing }
}

export async function importProfile(mode: ImportMode): Promise<ImportResult> {
  const window = owner()
  if (!window) return { status: 'failed' }

  const chosen = await dialog.showOpenDialog(window, {
    title: 'Abrir um perfil',
    defaultPath: await folderOrHome(),
    properties: ['openFile'],
    filters: [{ name: 'Perfil do Pulse', extensions: ['json'] }],
  })

  const path = chosen.filePaths[0]
  if (chosen.canceled || !path) return { status: 'canceled' }

  try {
    return await adopt(JSON.parse(await readFile(path, 'utf8')), mode)
  } catch {
    return { status: 'invalid' }
  }
}

export async function importFromLink(url: string, mode: ImportMode): Promise<ImportResult> {
  const address = url.trim()
  if (!/^https?:\/\//i.test(address)) return { status: 'invalid' }

  const control = new AbortController()
  const giveUp = setTimeout(() => control.abort(), FETCH_TIMEOUT_MS)

  try {
    const answer = await fetch(address, { signal: control.signal, cache: 'no-store' })
    if (!answer.ok) return { status: 'failed' }
    return await adopt(await answer.json(), mode)
  } catch {
    return { status: 'failed' }
  } finally {
    clearTimeout(giveUp)
  }
}

export interface SyncedFolder {
  path: string
  label: string
}

export async function listFolders(): Promise<SyncedFolder[]> {
  const home = homedir()

  const candidates: SyncedFolder[] = [
    { path: join(home, 'Meu Drive'), label: 'Google Drive' },
    { path: join(home, 'My Drive'), label: 'Google Drive' },
    { path: join(home, 'Google Drive'), label: 'Google Drive' },
    { path: join(home, 'OneDrive'), label: 'OneDrive' },
    { path: join(home, 'Documents'), label: 'Documentos' },
  ]

  const found: SyncedFolder[] = []

  for (const one of candidates) {
    if (found.some((other) => other.label === one.label)) continue
    try {
      await access(one.path)
      found.push(one)
    } catch {}
  }

  return found
}

export async function pickFolder(): Promise<string | null> {
  const window = owner()
  if (!window) return null

  const chosen = await dialog.showOpenDialog(window, {
    title: 'Escolher a pasta do perfil',
    defaultPath: await folderOrHome(),
    properties: ['openDirectory', 'createDirectory'],
  })

  return chosen.canceled ? null : (chosen.filePaths[0] ?? null)
}
