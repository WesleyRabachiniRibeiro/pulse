import type { Program } from '@pulse/domain'

export interface CatalogExtras {
  read(): Promise<readonly Program[]>
  write(programs: readonly Program[]): Promise<void>
}
