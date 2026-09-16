import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { CatalogPayload } from '@pulse/domain'
import { readCatalogPayload } from '@pulse/utils'
import type { CatalogCache } from '../../ports/catalog-cache'

export class JsonCatalogCache implements CatalogCache {
  async read(): Promise<CatalogPayload | null> {
    try {
      return readCatalogPayload(JSON.parse(await readFile(this.filePath(), 'utf8')))
    } catch {
      return null
    }
  }

  async write(payload: CatalogPayload): Promise<void> {
    try {
      const path = this.filePath()
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(payload, null, 2), 'utf8')
    } catch {
    }
  }

  private filePath(): string {
    return join(app.getPath('userData'), 'catalog.json')
  }
}
