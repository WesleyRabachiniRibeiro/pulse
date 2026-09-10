import { BrowserWindow } from 'electron'
import { register } from '../../ipc/register'

let current: BrowserWindow | null = null

export function holdWindow(window: BrowserWindow | null): void {
  current = window
}

export function registerWindow(): void {
  register('window:minimize', () => {
    current?.minimize()
  })

  register('window:toggleMaximize', () => {
    if (!current) return false
    if (current.isMaximized()) {
      current.unmaximize()
      return false
    }
    current.maximize()
    return true
  })

  register('window:close', () => {
    current?.close()
  })
}
