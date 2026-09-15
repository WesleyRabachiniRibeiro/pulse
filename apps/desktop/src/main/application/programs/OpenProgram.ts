import type { Catalog } from '@pulse/domain'
import type { ProgramOpener } from '../../ports/program-opener'

export class OpenProgram {
  private shortcuts: Record<string, string> | null = null
  private looking: Promise<Record<string, string>> | null = null

  constructor(
    private readonly catalog: Catalog,
    private readonly opener: ProgramOpener,
  ) {}

  // Varrer o menu Iniciar custa segundos, então a tela pergunta por vários de
  // uma vez e a resposta serve para todos até alguém pedir de novo.
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
    // O atalho sumiu entre a varredura e o clique: esquecer força uma nova.
    if (!ok) this.shortcuts = null
    return ok
  }

  forget(): void {
    this.shortcuts = null
  }
}
