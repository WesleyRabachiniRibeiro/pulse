import { register } from './register'
import type { CatalogService } from '../application/catalog/CatalogService'

const WARM_DELAY_MS = 5000

export function registerCatalog(catalogService: CatalogService): void {
  register('catalog:installed', (input) => catalogService.listInstalled(Boolean(input.fresh)))
  register('catalog:autostart', () => catalogService.listAutostart())
  register('catalog:versions', (input) => catalogService.listVersions(input.id))

  setTimeout(() => {
    void catalogService.listInstalled(false).catch(() => undefined)
    void catalogService.listAutostart().catch(() => undefined)
  }, WARM_DELAY_MS)
}
