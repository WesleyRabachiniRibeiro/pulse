import type { CatalogPayload } from '@pulse/domain'

// Guarda o último catálogo que a rede entregou, para a próxima abertura não
// depender de estar online.
export interface CatalogCache {
  read(): Promise<CatalogPayload | null>
  write(payload: CatalogPayload): Promise<void>
}
