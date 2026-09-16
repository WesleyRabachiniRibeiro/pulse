import type { Run } from '@pulse/domain'

export interface QueueRepository {
  get(): Run | null
  set(run: Run | null): void
}
