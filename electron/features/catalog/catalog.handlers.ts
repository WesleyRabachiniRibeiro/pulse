import { register } from '../../ipc/register'
import { listAutostart, listInstalled, listVersions, warmCatalog } from './catalog.service'

const WARM_AFTER_PREFLIGHT_MS = 5000

export function registerCatalog(): void {
  register('catalog:installed', (input) => listInstalled(input))
  register('catalog:autostart', () => listAutostart())
  register('catalog:versions', (input) => listVersions(input.id))

  setTimeout(warmCatalog, WARM_AFTER_PREFLIGHT_MS)
}
