import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import {
  EMPTY_PREFERENCES,
  preferencesSchema,
  type Preferences,
} from '@shared/domain/preferences'

function arquivo(): string {
  return join(app.getPath('userData'), 'preferences.json')
}

let cache: Preferences | null = null

export async function readPreferences(): Promise<Preferences> {
  if (cache) return cache

  try {
    const bruto: unknown = JSON.parse(await readFile(arquivo(), 'utf8'))
    const lido = preferencesSchema.safeParse(bruto)
    cache = lido.success ? lido.data : EMPTY_PREFERENCES
  } catch {
    cache = EMPTY_PREFERENCES
  }

  return cache
}

export async function writePreferences(change: Preferences): Promise<Preferences> {
  const atual = await readPreferences()
  const next = preferencesSchema.parse({ ...atual, ...change })
  cache = next

  try {
    const path = arquivo()
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, JSON.stringify(next, null, 2), 'utf8')
  } catch {}

  return next
}
