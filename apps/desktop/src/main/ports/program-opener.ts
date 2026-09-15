import type { Program } from '@pulse/domain'

export interface ProgramOpener {
  // Devolve, por id de programa, o atalho do menu Iniciar que abre ele.
  find(programs: readonly Program[]): Promise<Record<string, string>>

  open(path: string): Promise<boolean>
}
