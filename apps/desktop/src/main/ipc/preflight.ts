import { BrowserWindow } from 'electron'
import { register } from './register'
import type { RunSystemVerification } from '../application/preflight/RunSystemVerification'

const WARM_DELAY_MS = 1200

export function registerPreflight(preflightService: RunSystemVerification): void {
  register('preflight:drives', (input) => preflightService.drives(Boolean(input.fresh)))
  register('preflight:run', (input) => preflightService.run(input))

  preflightService.subscribe((partial) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('preflight:event', partial)
    }
  })

  setTimeout(() => preflightService.warm(), WARM_DELAY_MS)
}
