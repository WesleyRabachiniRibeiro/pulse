import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { z } from 'zod'
import { programSchema, type Program } from '@pulse/domain'
import type { CatalogExtras } from '../../ports/catalog-extras'

const extrasSchema = z.array(programSchema)

export class JsonCatalogExtras implements CatalogExtras {
  async read(): Promise<readonly Program[]> {
    try {
      const read = extrasSchema.safeParse(JSON.parse(await readFile(this.filePath(), 'utf8')))
      return read.success ? (read.data as readonly Program[]) : []
    } catch {
      return []
    }
  }

  async write(programs: readonly Program[]): Promise<void> {
    try {
      const path = this.filePath()
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, `${JSON.stringify(programs, null, 2)}\n`, 'utf8')
    } catch {
    }
  }

  private filePath(): string {
    return join(app.getPath('userData'), 'meus-programas.json')
  }
}
