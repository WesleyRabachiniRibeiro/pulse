import { BrowserWindow } from 'electron'
import { register } from './register'
import type { UpdateService } from '../application/updates/UpdateService'

export function registerUpdates(updateService: UpdateService): void {
  register('update:state', () => updateService.currentState())
  register('update:install', () => {
    updateService.installNow()
  })

  updateService.subscribe((state) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('update:event', state)
    }
  })

  updateService.start()
}
