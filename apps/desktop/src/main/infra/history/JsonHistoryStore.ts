import { app } from 'electron'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { historySchema, type RunRecord } from '@pulse/domain'
import type { HistoryStore } from '../../ports/history-store'

// Arquivo próprio, e não junto das preferências: o histórico cresce a cada fila
// e as preferências são um punhado de campos lidos na abertura.
export class JsonHistoryStore implements HistoryStore {
  private cache: readonly RunRecord[] | null = null

  async read(): Promise<readonly RunRecord[]> {
    if (this.cache) return this.cache

    try {
      const raw: unknown = JSON.parse(await readFile(this.filePath(), 'utf8'))
      const parsed = historySchema.safeParse(raw)
      this.cache = parsed.success ? parsed.data : []
    } catch {
      this.cache = []
    }

    return this.cache
  }

  async write(history: readonly RunRecord[]): Promise<void> {
    this.cache = history

    try {
      const path = this.filePath()
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, JSON.stringify(history, null, 2), 'utf8')
    } catch {
      // sem permissão de escrever em userData: o histórico ainda vale para esta
      // sessão pelo cache, só não sobrevive a um reinício.
    }
  }

  private filePath(): string {
    return join(app.getPath('userData'), 'history.json')
  }
}
