import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { currentUpdate, installNow, startUpdates, subscribe } from './updates.service'

export function registerUpdates(): void {
  register('update:state', () => currentUpdate())
  register('update:install', () => installNow())

  subscribe((state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('update:event', state)
    }
  })

  startUpdates()
}
