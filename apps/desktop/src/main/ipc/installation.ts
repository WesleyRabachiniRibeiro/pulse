import { BrowserWindow } from 'electron'
import { register } from './register'
import type { QueueOrchestrator } from '../application/queue/QueueOrchestrator'

export function registerInstallation(orchestrator: QueueOrchestrator): void {
  register('installation:start', (input) => orchestrator.start(input.requests, input.drive))
  register('installation:append', (input) => orchestrator.append(input.requests))
  register('installation:state', () => orchestrator.currentState())
  register('installation:cancel', () => orchestrator.cancel())
  register('installation:cancelItem', (input) => orchestrator.cancelItem(input.id))
  register('installation:retry', (input) => orchestrator.retry(input.id))
  register('installation:grant', (input) => orchestrator.grantPermission(input.id))
  register('installation:uninstall', (input) => orchestrator.uninstall(input.id))

  orchestrator.subscribe((run) => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('installation:event', run)
    }
  })
}
