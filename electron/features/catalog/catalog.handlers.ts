import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { listAutostart, listInstalled, listVersions, warmCatalog } from './catalog.service'
import { readInventory } from './inventory.service'
import {
  loadCatalog,
  refreshCatalog,
  refreshVersionsFromWinget,
  subscribe,
} from './remote.service'

const WARM_AFTER_PREFLIGHT_MS = 5000
const REFRESH_AFTER_START_MS = 2500
const VERSIONS_AFTER_START_MS = 12_000

export function registerCatalog(): void {
  subscribe((catalog) => {
    for (const win of BrowserWindow.getAllWindows()) win.webContents.send('catalog:event', catalog)
  })

  register('catalog:list', () => loadCatalog())
  register('catalog:installed', (input) => listInstalled(input))
  register('catalog:inventory', (input) => readInventory(input.fresh === true))
  register('catalog:autostart', () => listAutostart())
  register('catalog:versions', (input) => listVersions(input.id))

  setTimeout(() => void refreshCatalog().catch(() => undefined), REFRESH_AFTER_START_MS)
  setTimeout(warmCatalog, WARM_AFTER_PREFLIGHT_MS)
  setTimeout(() => void refreshVersionsFromWinget().catch(() => undefined), VERSIONS_AFTER_START_MS)
}
