import type { Program } from '@pulse/domain'

export interface ProgramOpener {
  find(programs: readonly Program[]): Promise<Record<string, string>>

  open(path: string): Promise<boolean>
}
