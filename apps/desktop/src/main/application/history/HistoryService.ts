import { type Run, type RunRecord } from '@pulse/domain'
import { recordOf, withRecord } from '@pulse/utils'
import type { HistoryStore } from '../../ports/history-store'

export class HistoryService {
  private lastRecorded: string | null = null

  constructor(private readonly store: HistoryStore) {}

  read(): Promise<readonly RunRecord[]> {
    return this.store.read()
  }

  async clear(): Promise<readonly RunRecord[]> {
    await this.store.write([])
    return []
  }

  async onRunChanged(run: Run): Promise<void> {
    const record = recordOf(run)
    if (!record || this.lastRecorded === record.startedAt) return

    this.lastRecorded = record.startedAt
    await this.store.write(withRecord(await this.store.read(), record))
  }
}
