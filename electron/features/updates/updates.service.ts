import { app } from 'electron'
import updater from 'electron-updater'
import { EMPTY_UPDATE, type UpdateState } from '@shared/domain/update'
import { currentState, subscribe as onInstallation } from '../installation/installation.service'

const { autoUpdater } = updater

type Listener = (state: UpdateState) => void

const listeners = new Set<Listener>()

let state: UpdateState = EMPTY_UPDATE

export function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function currentUpdate(): UpdateState {
  return { ...state }
}

function put(change: Partial<UpdateState>): void {
  state = { ...state, ...change }
  for (const listener of listeners) listener({ ...state })
}

function queueRunning(): boolean {
  const run = currentState()
  return run !== null && run.finishedAt === null
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível verificar atualizações.'
}

function holdWhileBusy(): void {
  const busy = queueRunning()
  autoUpdater.autoInstallOnAppQuit = !busy
  if (state.blocked !== busy) put({ blocked: busy })
}

const FIRST_CHECK_MS = 8000
const RETRY_MS = 4 * 60 * 60_000

function supported(): boolean {
  return app.isPackaged && !process.env['PORTABLE_EXECUTABLE_DIR']
}

export function startUpdates(): void {
  if (!supported()) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('checking-for-update', () => {
    put({ status: 'checking', message: null })
  })

  autoUpdater.on('update-available', (info) => {
    put({ status: 'downloading', version: info.version, percent: 0, message: null })
  })

  autoUpdater.on('update-not-available', () => {
    put({ status: 'idle', version: null, percent: 0, message: null })
  })

  autoUpdater.on('download-progress', (progress) => {
    put({ status: 'downloading', percent: Math.round(progress.percent) })
  })

  autoUpdater.on('update-downloaded', (info) => {
    put({ status: 'ready', version: info.version, percent: 100, message: null })
    holdWhileBusy()
  })

  autoUpdater.on('error', (e) => {
    put({ status: 'error', message: messageOf(e) })
  })

  onInstallation(() => {
    if (state.status === 'ready') holdWhileBusy()
  })

  const check = (): void => {
    void autoUpdater.checkForUpdates().catch(() => undefined)
  }

  setTimeout(check, FIRST_CHECK_MS)
  setInterval(check, RETRY_MS)
}

export function installNow(): void {
  if (state.status !== 'ready') return
  if (queueRunning()) {
    holdWhileBusy()
    return
  }
  setImmediate(() => autoUpdater.quitAndInstall(true, true))
}
