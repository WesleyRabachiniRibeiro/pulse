import { app, BrowserWindow, nativeImage, Notification } from 'electron'
import { join } from 'node:path'
import { PROGRAM_BY_ID, type Item, type Run } from '@pulse/domain'
import { anyoneWaiting, tally } from '@pulse/utils'
import type { NotificationPresenter } from '../../ports/notification-presenter'

function iconPath(fileName: string): string {
  const dir = app.isPackaged
    ? join(process.resourcesPath, 'icons')
    : join(app.getAppPath(), 'resources', 'icons')
  return join(dir, fileName)
}

type Alert = 'failed' | 'waiting' | null

function nameOf(item: Item): string {
  return PROGRAM_BY_ID.get(item.id)?.name ?? item.id
}

export function nameAppForWindows(): void {
  app.setAppUserModelId('com.pulse.installer')
}

export class ElectronNotificationPresenter implements NotificationPresenter {
  private readonly announced = new Set<string>()
  private watching: string | null = null
  private lastBadge: Alert = null
  private pending: Alert = null
  private listening = false

  present(run: Run): void {
    const window = BrowserWindow.getAllWindows()[0]
    if (!window || window.isDestroyed()) return

    this.resetOnNewRun(run)
    this.followFocus(window)

    const failed = run.items.filter((i) => i.status === 'failed')
    const waiting = anyoneWaiting(run.items)

    this.pending = failed.length > 0 ? 'failed' : waiting ? 'waiting' : null

    const looking = window.isFocused() && !window.isMinimized()
    this.showBadge(window, looking ? null : this.pending)

    if (looking) return

    for (const item of failed) {
      const key = 'failed:' + item.id
      if (this.announced.has(key)) continue
      this.announced.add(key)
      window.flashFrame(true)
      this.toast(window, nameOf(item) + ' não foi instalado', item.error ?? 'A instalação falhou.')
    }

    for (const item of run.items) {
      if (item.status !== 'waiting') continue
      const key = 'waiting:' + item.id + ':' + item.detail
      if (this.announced.has(key)) continue
      this.announced.add(key)
      window.flashFrame(true)
      this.toast(window, 'O Pulse precisa de você', item.detail)
    }

    if (run.finishedAt) {
      const key = 'done:' + run.finishedAt
      const counts = tally(run.items)
      if (!this.announced.has(key) && counts.failed > 0) {
        this.announced.add(key)
        window.flashFrame(true)
        this.toast(
          window,
          'Instalação encerrada',
          counts.done + ' de ' + counts.total + ' prontos, ' + counts.failed + ' ficaram de fora.',
        )
      }
    }
  }

  private resetOnNewRun(run: Run): void {
    if (this.watching === run.startedAt) return
    this.watching = run.startedAt
    this.announced.clear()
    this.lastBadge = null
  }

  private showBadge(window: BrowserWindow, badge: Alert): void {
    if (badge === this.lastBadge) return
    this.lastBadge = badge

    if (badge === null) {
      window.setOverlayIcon(null, '')
      return
    }

    const path = iconPath(badge === 'failed' ? 'badge-failed.png' : 'badge-waiting.png')
    const label = badge === 'failed' ? 'Algo falhou' : 'Precisa de você'
    window.setOverlayIcon(nativeImage.createFromPath(path), label)
  }

  private followFocus(window: BrowserWindow): void {
    if (this.listening) return
    this.listening = true

    window.on('focus', () => this.showBadge(window, null))
    window.on('blur', () => this.showBadge(window, this.pending))
    window.on('closed', () => {
      this.listening = false
    })
  }

  private toast(window: BrowserWindow, title: string, body: string): void {
    if (!Notification.isSupported()) return

    const note = new Notification({ title, body, silent: false })
    note.on('click', () => {
      if (window.isMinimized()) window.restore()
      window.show()
      window.focus()
    })
    note.show()
  }
}
