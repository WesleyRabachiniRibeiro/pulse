import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { drivesForScreen, runPreflight, subscribePartial, warmDrives } from './preflight.service'

export function registerPreflight(): void {
  register('preflight:drives', (input) => drivesForScreen(input))
  register('preflight:run', (input) => runPreflight(input))

  subscribePartial((partial) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('preflight:event', partial)
    }
  })

  setTimeout(warmDrives, 1200)
}
