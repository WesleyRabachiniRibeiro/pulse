import { BrowserWindow } from 'electron'
import {
  EMPTY_DEFAULTS,
  EMPTY_PREFERENCES,
  withDefaults,
  type Preferences,
  type Request,
} from '@pulse/domain'
import { register } from './register'
import type { QueueOrchestrator } from '../application/queue/QueueOrchestrator'
import type { PreferencesService } from '../application/preferences/PreferencesService'

export function registerInstallation(
  orchestrator: QueueOrchestrator,
  preferencesService: PreferencesService,
): void {
  // Os padrões descem para o pedido antes de virar item, para que a fila, o
  // resumo e o histórico mostrem o que de fato vai rodar.
  async function withCurrentDefaults(requests: readonly Request[]): Promise<Request[]> {
    const preferences: Preferences = await preferencesService
      .read()
      .catch(() => EMPTY_PREFERENCES)
    const defaults = preferences.defaults ?? EMPTY_DEFAULTS

    return requests.map((request) => {
      const settings = withDefaults(request.settings, defaults)
      return Object.keys(settings).length === 0 ? { ...request } : { ...request, settings }
    })
  }

  register('installation:start', async (input) =>
    orchestrator.start(await withCurrentDefaults(input.requests), input.drive),
  )
  register('installation:append', async (input) =>
    orchestrator.append(await withCurrentDefaults(input.requests)),
  )
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
