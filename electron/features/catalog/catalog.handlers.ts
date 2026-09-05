import { register } from '../../ipc/register'
import { listAutostart, listInstalled, listVersions } from './catalog.service'

export function registerCatalog(): void {
  register('catalog:installed', () => listInstalled())
  register('catalog:autostart', () => listAutostart())
  register('catalog:versions', (input) => listVersions(input.id))
}
