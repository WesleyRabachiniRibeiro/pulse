import { json, jsonOr, run, withParams } from '@main/core/powershell'
import { registryEntrySchema, type RegistryEntry } from '@shared/domain/installed'
import installedNamesScript from './powershell/GetInstalledNames.ps1?raw'
import uninstallCommandsScript from './powershell/GetUninstallCommands.ps1?raw'
import registryEntriesScript from './powershell/GetRegistryEntries.ps1?raw'
import autostartEntriesScript from './powershell/GetAutostartEntries.ps1?raw'
import setStartupStateScript from './powershell/SetStartupState.ps1?raw'

const READ_TIMEOUT_MS = 25_000
const ENTRIES_TIMEOUT_MS = 30_000
const WIDE = 16 * 1024 * 1024

export interface UninstallEntry {
  name: string
  quiet: string
  plain: string
}

export interface AutostartEntry {
  name: string
  value: string
  enabled: boolean
}

function asArray<T>(value: unknown): T[] {
  if (value === null || value === undefined) return []
  return (Array.isArray(value) ? value : [value]) as T[]
}

export async function readInstalledDisplayNames(): Promise<string[]> {
  const raw = await json<unknown>(installedNamesScript, {
    timeoutMs: READ_TIMEOUT_MS,
    maxBuffer: WIDE,
  })
  return asArray<unknown>(raw).filter((name): name is string => typeof name === 'string')
}

export async function readUninstallEntries(): Promise<UninstallEntry[]> {
  const raw = await jsonOr<unknown>(null, uninstallCommandsScript, {
    timeoutMs: READ_TIMEOUT_MS,
    maxBuffer: WIDE,
  })
  return asArray<UninstallEntry>(raw)
}

export async function readAutostartEntries(): Promise<AutostartEntry[]> {
  const raw = await jsonOr<unknown>(null, autostartEntriesScript, {
    timeoutMs: READ_TIMEOUT_MS,
    maxBuffer: WIDE,
  })
  return asArray<AutostartEntry>(raw)
}

function trimmed(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

export async function readRegistryEntries(): Promise<RegistryEntry[]> {
  const raw = await jsonOr<unknown>(null, registryEntriesScript, {
    timeoutMs: ENTRIES_TIMEOUT_MS,
    maxBuffer: WIDE,
  })

  const entries: RegistryEntry[] = []

  for (const row of asArray<Record<string, unknown>>(raw)) {
    const name = trimmed(row['name'])
    const key = trimmed(row['key'])
    if (!name || !key) continue

    const read = registryEntrySchema.safeParse({
      key,
      name,
      ...(trimmed(row['publisher']) ? { publisher: trimmed(row['publisher']) } : {}),
      ...(trimmed(row['version']) ? { version: trimmed(row['version']) } : {}),
      ...(row['system'] === true ? { system: true } : {}),
      ...(trimmed(row['location']) ? { location: trimmed(row['location']) } : {}),
      ...(trimmed(row['icon']) ? { icon: trimmed(row['icon']) } : {}),
      ...(trimmed(row['uninstall']) ? { uninstall: trimmed(row['uninstall']) } : {}),
    })

    if (read.success) entries.push(read.data)
  }

  return entries
}

export async function writeStartupState(name: string, on: boolean): Promise<void> {
  await run(withParams(setStartupStateScript, { Name: name, TurnOn: on }), {
    timeoutMs: READ_TIMEOUT_MS,
  }).catch(() => undefined)
}
