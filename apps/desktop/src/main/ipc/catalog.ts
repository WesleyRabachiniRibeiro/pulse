import { BrowserWindow } from 'electron'
import type { Program } from '@pulse/domain'
import type { IpcOutput } from '@pulse/ipc-contract'
import { register } from './register'
import type { CatalogService } from '../application/catalog/CatalogService'
import type { LiveCatalog } from '../application/catalog/LiveCatalog'

const WARM_DELAY_MS = 5000

// O contrato descreve o que trafega, e o domínio o que o app manipula. As duas
// formas são a mesma coisa com readonly e categoria tipada a mais de um lado.
function wire(programs: readonly Program[]): IpcOutput<'catalog:mine'> {
  return programs.map((program) => ({ ...program })) as unknown as IpcOutput<'catalog:mine'>
}

export function registerCatalog(catalogService: CatalogService, catalog: LiveCatalog): void {
  register('catalog:state', () => catalogService.currentState())
  register('catalog:mine', () => wire(catalogService.myPrograms()))
  register('catalog:add', (input) => catalogService.adoptProgram(input))
  register('catalog:remove', async (input) => {
    await catalogService.removeProgram(input.id)
    return wire(catalogService.myPrograms())
  })
  register('catalog:payload', () => catalog.payload())
  register('catalog:retry', async () => {
    await catalogService.retry()
    return catalogService.currentState()
  })

  catalogService.subscribe((state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('catalog:event', state)
    }
  })

  register('catalog:tree', () => catalogService.listInstalledTree())
  register('catalog:upgrades', () => catalogService.listUpgrades())
  register('catalog:startup', async () => [...(await catalogService.listStartup())])
  register('catalog:setStartup', async (input) => [
    ...(await catalogService.setStartup(input.name, input.on)),
  ])
  register('catalog:installed', (input) => catalogService.listInstalled(Boolean(input.fresh)))
  register('catalog:autostart', () => catalogService.listAutostart())
  register('catalog:versions', (input) => catalogService.listVersions(input.id))

  setTimeout(() => {
    void catalogService.listInstalled(false).catch(() => undefined)
    void catalogService.listAutostart().catch(() => undefined)
  }, WARM_DELAY_MS)
}
