import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { EMPTY_PREFERENCES, preferencesSchema, type Preferences } from '@pulse/domain'
import type { PreferencesStore } from '../../ports/preferences-store'

export class JsonPreferencesStore implements PreferencesStore {
  private cache: Preferences | null = null

  async read(): Promise<Preferences> {
    if (this.cache) return this.cache

    try {
      const raw: unknown = JSON.parse(await readFile(this.filePath(), 'utf8'))
      const parsed = preferencesSchema.safeParse(raw)
      this.cache = parsed.success ? parsed.data : EMPTY_PREFERENCES
    } catch {
      this.cache = EMPTY_PREFERENCES
    }

    return this.cache
  }

  async write(patch: Preferences): Promise<Preferences> {
    const current = await this.read()
    const next = preferencesSchema.parse({ ...current, ...patch })
    this.cache = next

    try {
      const path = this.filePath()
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(next, null, 2), 'utf8')
    } catch {
      // sem permissão de escrever em userData: a preferência ainda vale para
      // esta sessão via cache, só não sobrevive a um reinício do app.
    }

    return next
  }

  private filePath(): string {
    return join(app.getPath('userData'), 'preferences.json')
  }
}
