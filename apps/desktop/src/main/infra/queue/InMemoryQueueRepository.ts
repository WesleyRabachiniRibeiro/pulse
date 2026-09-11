import type { Run } from '@pulse/domain'
import type { QueueRepository } from '../../ports/queue-repository'

export class InMemoryQueueRepository implements QueueRepository {
  private run: Run | null = null

  get(): Run | null {
    return this.run
  }

  set(run: Run | null): void {
    this.run = run
  }
}
