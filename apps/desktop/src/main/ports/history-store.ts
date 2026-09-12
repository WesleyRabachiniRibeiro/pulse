import type { RunRecord } from '@pulse/domain'

export interface HistoryStore {
  read(): Promise<readonly RunRecord[]>
  write(history: readonly RunRecord[]): Promise<void>
}
