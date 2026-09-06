import { app, BrowserWindow, nativeImage, Notification } from 'electron'
import { PROGRAM_BY_ID } from '@shared/domain/catalog'
import { anyoneWaiting, tally, type Item, type Run } from '@shared/domain/installation'

const BADGE_FAILED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAfklEQVR42r2TwQnAIAxFXcOJnMdJ3MKNeuggQntof/kSDw16KNEGPohJXkiMDoCzyK0EeABB5L8AGJwB4C6lSiz3QL3k/do2nCnhiLGKZ97RpyEakBnYErUEkkcAkl+VtegT8z1AYL+j5CaZSVgCMLdgHuKUZzQv0pRV/vc3PibDGLLxBhV4AAAAAElFTkSuQmCC'
const BADGE_WAITING = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAfklEQVR42mP4//8/AyWYgZYGSP7//98diiVJMQCkeNl/EPj1HoIhYBk2g7Bpvvnvzb7/f84E/f+9XwWMQWyQGEgO3RB0A5aBFMI0omOoIctwGQAyGcVmdAySgwJJbAa4g/yLSzMMQ8PEnSYGUOwFigORKtFIcUKiSlKmb24EAN5yGYJdCRo9AAAAAElFTkSuQmCC'

type Alert = 'failed' | 'waiting' | null

function nameOf(item: Item): string {
  return PROGRAM_BY_ID.get(item.id)?.name ?? item.id
}

export function nameForWindows(): void {
  app.setAppUserModelId('com.pulse.installer')
}

const announced = new Set<string>()
let watching: string | null = null
let lastBadge: Alert = null
let pending: Alert = null
let listening = false

function resetOnNewRun(run: Run): void {
  if (watching === run.startedAt) return
  watching = run.startedAt
  announced.clear()
  lastBadge = null
}

function showBadge(window: BrowserWindow, badge: Alert): void {
  if (badge === lastBadge) return
  lastBadge = badge

  if (badge === null) {
    window.setOverlayIcon(null, '')
    return
  }

  const url = badge === 'failed' ? BADGE_FAILED : BADGE_WAITING
  const label = badge === 'failed' ? 'Algo falhou' : 'Precisa de você'
  window.setOverlayIcon(nativeImage.createFromDataURL(url), label)
}

function followFocus(window: BrowserWindow): void {
  if (listening) return
  listening = true

  window.on('focus', () => showBadge(window, null))
  window.on('blur', () => showBadge(window, pending))
  window.on('closed', () => {
    listening = false
  })
}

function toast(window: BrowserWindow, title: string, body: string): void {
  if (!Notification.isSupported()) return

  const note = new Notification({ title, body, silent: false })
  note.on('click', () => {
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  note.show()
}

export function alertFrom(run: Run): void {
  const window = BrowserWindow.getAllWindows()[0]
  if (!window || window.isDestroyed()) return

  resetOnNewRun(run)
  followFocus(window)

  const failed = run.items.filter((i) => i.status === 'failed')
  const waiting = anyoneWaiting(run.items)

  pending = failed.length > 0 ? 'failed' : waiting ? 'waiting' : null

  const looking = window.isFocused() && !window.isMinimized()
  showBadge(window, looking ? null : pending)

  if (looking) return

  for (const item of failed) {
    const key = 'failed:' + item.id
    if (announced.has(key)) continue
    announced.add(key)
    window.flashFrame(true)
    toast(window, nameOf(item) + ' não foi instalado', item.error ?? 'A instalação falhou.')
  }

  for (const item of run.items) {
    if (item.status !== 'waiting') continue
    const key = 'waiting:' + item.id + ':' + item.detail
    if (announced.has(key)) continue
    announced.add(key)
    window.flashFrame(true)
    toast(window, 'O Pulse precisa de você', item.detail)
  }

  if (run.finishedAt) {
    const key = 'done:' + run.finishedAt
    const counts = tally(run.items)
    if (!announced.has(key) && counts.failed > 0) {
      announced.add(key)
      window.flashFrame(true)
      toast(
        window,
        'Instalação encerrada',
        counts.done + ' de ' + counts.total + ' prontos, ' + counts.failed + ' ficaram de fora.',
      )
    }
  }
}
