import { app } from 'electron'
import updater from 'electron-updater'
import { EMPTY_UPDATE, type UpdateState } from '@pulse/domain'
import type { UpdateChecker } from '../../ports/update-checker'

const { autoUpdater } = updater

const FIRST_CHECK_MS = 8_000
const RETRY_MS = 4 * 60 * 60_000

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível verificar atualizações.'
}

function supported(): boolean {
  return app.isPackaged && !process.env['PORTABLE_EXECUTABLE_DIR']
}

export class ElectronUpdateChecker implements UpdateChecker {
  private readonly listeners = new Set<(state: UpdateState) => void>()
  private state: UpdateState = EMPTY_UPDATE

  subscribe(listener: (state: UpdateState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  currentState(): UpdateState {
    return { ...this.state }
  }

  start(): void {
    if (!supported()) return

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('checking-for-update', () => {
      this.put({ status: 'checking', message: null })
    })

    autoUpdater.on('update-available', (info) => {
      this.put({ status: 'downloading', version: info.version, percent: 0, message: null })
    })

    autoUpdater.on('update-not-available', () => {
      this.put({ status: 'idle', version: null, percent: 0, message: null })
    })

    autoUpdater.on('download-progress', (progress) => {
      this.put({ status: 'downloading', percent: Math.round(progress.percent) })
    })

    autoUpdater.on('update-downloaded', (info) => {
      this.put({ status: 'ready', version: info.version, percent: 100, message: null })
    })

    autoUpdater.on('error', (e) => {
      this.put({ status: 'error', message: messageOf(e) })
    })

    const check = (): void => {
      void autoUpdater.checkForUpdates().catch(() => undefined)
    }

    setTimeout(check, FIRST_CHECK_MS)
    setInterval(check, RETRY_MS)
  }

  installNow(): void {
    setImmediate(() => autoUpdater.quitAndInstall(true, true))
  }

  setBusy(busy: boolean): void {
    autoUpdater.autoInstallOnAppQuit = !busy
    if (this.state.blocked !== busy) this.put({ blocked: busy })
  }

  private put(change: Partial<UpdateState>): void {
    this.state = { ...this.state, ...change }
    for (const listener of this.listeners) listener({ ...this.state })
  }
}
