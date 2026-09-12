import type { Program } from '@pulse/domain'

// Os programas que a pessoa adicionou nesta máquina. Ficam à parte do catálogo
// publicado, e sobrevivem a ele mudar.
export interface CatalogExtras {
  read(): Promise<readonly Program[]>
  write(programs: readonly Program[]): Promise<void>
}
