import type { Drive } from '@pulse/domain'
import type { DriveLister } from '../../ports/drive-lister'

const REUSE_MS = 20_000

export class DriveCache {
  private cached: { at: number; drives: Drive[] } | null = null
  private pending: Promise<Drive[]> | null = null

  constructor(private readonly driveLister: DriveLister) {}

  peek(): Drive[] | null {
    if (this.cached && Date.now() - this.cached.at < REUSE_MS) return this.cached.drives
    return null
  }

  get(fresh: boolean, onEnriched?: (drives: Drive[]) => void): Promise<Drive[]> {
    if (!fresh) {
      const ready = this.peek()
      if (ready) return Promise.resolve(ready)
    }

    if (this.pending) return this.pending

    const detailed: { drives: Drive[] | null } = { drives: null }

    const task = this.driveLister
      .listDrives((enriched) => {
        detailed.drives = enriched
        this.cached = { at: Date.now(), drives: enriched }
        onEnriched?.(enriched)
      })
      .then((fast) => {
        if (detailed.drives) return detailed.drives
        this.cached = { at: Date.now(), drives: fast }
        return fast
      })
      .finally(() => {
        this.pending = null
      })

    this.pending = task
    return task
  }

  warm(): void {
    void this.get(true).catch(() => undefined)
  }
}
