import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'
import { alertFrom } from '../alerts'
import {
  append,
  cancel,
  cancelItem,
  currentState,
  retry,
  start,
  subscribe,
  uninstall,
} from './installation.service'

export function registerInstallation(): void {
  register('installation:start', (input) => start(input.requests, input.drive))
  register('installation:append', (input) => append(input.requests))
  register('installation:state', () => currentState())
  register('installation:cancel', () => cancel())
  register('installation:cancelItem', (input) => cancelItem(input.id))
  register('installation:retry', (input) => retry(input.id))
  register('installation:uninstall', (input) => uninstall(input.id))

  subscribe((run) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('installation:event', run)
    }
    alertFrom(run)
  })
}
