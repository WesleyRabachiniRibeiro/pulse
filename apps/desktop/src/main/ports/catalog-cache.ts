import type { CatalogPayload } from '@pulse/domain'

export interface CatalogCache {
  read(): Promise<CatalogPayload | null>
  write(payload: CatalogPayload): Promise<void>
}
