import type { Catalog } from '@pulse/domain'
import type { ProgramOpener } from '../../ports/program-opener'

export class OpenProgram {
  private shortcuts: Record<string, string> | null = null
  private looking: Promise<Record<string, string>> | null = null

  constructor(
    private readonly catalog: Catalog,
    private readonly opener: ProgramOpener,
  ) {}

  private async scan(): Promise<Record<string, string>> {
    if (this.shortcuts) return this.shortcuts
    if (!this.looking) {
      this.looking = this.opener.find(this.catalog.programs).then((found) => {
        this.shortcuts = found
        this.looking = null
        return found
      })
    }
    return this.looking
  }

  async openable(ids: readonly string[]): Promise<string[]> {
    const found = await this.scan()
    return ids.filter((id) => found[id] !== undefined)
  }

  async open(id: string): Promise<boolean> {
    const found = await this.scan()
    const path = found[id]
    if (!path) return false

    const ok = await this.opener.open(path)

    if (!ok) this.shortcuts = null
    return ok
  }
}
