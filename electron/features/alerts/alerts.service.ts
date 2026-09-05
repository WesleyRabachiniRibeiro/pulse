import { app, BrowserWindow, nativeImage, Notification } from 'electron'
import { PROGRAM_BY_ID } from '@shared/domain/catalog'
import { anyoneWaiting, tally, type Item, type Run } from '@shared/domain/installation'

const BADGE_FAILED = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAACBElEQVR42qWTsW7TUBSG/3Pt2FEcqY5UtakaR0Ria0ozMVRigBfoA7AwoLJUwI6yFGUH2oWKgYUH6AuUAakDqtSEJhuSUZ2qSVvJjmRbsePrw+BQoGqnfNJd7j3/uefe8x/CFGYWRJQCQOA4lUKl8hBAfXrcDfv974Zl9W/GXosBwLVtk5l3mNmOh5ehf3Qs/aNjGQ8vQ2a2mXnHtW3zXw39yRa5bkMzzc/Jr9O1wYePSfijS4nrEQCoJZMLD+pcfvlCVe9VO7HnPdNLpTYzC2JmMeo55tyKdRB8/bbmvHkbcRTrwigAipKVKCXSIATpWmS1mrrx+FFn1HOezK1Y2Q3M/C6xT1/9fPo8JiIN+TyQJPgPVQXGYzBzfP/LJ02tVd8T0WvBvl8GsHG+uyc5im4XA9lePg+OIu18d08C2GDfLwsYxvrk4moxbJ+QMAxAStyJlBCGgbB9QpOLq0UYxroAUJ84Z7p0vezNzHcnYAYUBdL1MHHOdAB1gRkRALo5azlSSmZWPtHd0USAlFBKJnLWcgSgKxAEh7mF+WGhscppEPxt3W0oCtIgQKGxyrmF+SGC4FBQsTgAsL+0tamQrscYj7OW3WTaRtL1eGlrUwGwT8XiQEyNtK3Wqh2r1dSYOUq9UfZhQmSLGak3AjNHVqupqbVqZ9Rztq+dOIuVZx+mWcf5Nw0RXnf5DvzqAAAAAElFTkSuQmCC'
const BADGE_WAITING = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAB90lEQVR42qWTsUtbURTGf+defa+JfZiKJhnsINRJwVKlg1CHTu1Q/Be6d2hH6ehQHFu0e/8F6dBOXQoKJdYGdGohQwWTKGp4TdL7zH2nQ15FBF3ywYXLvef77ncu3xEyqKoRkRSg3f49mc9PPgRms+u9Tufg28jI3YOrtRdkAD3dLajquqrWeu3Djqtve1ff9r32YUdVa6q6rqe7hcsc+a/m/jTuByPFDxr/mmt9f9NzzYqk7kQATDimYXFBRx+8HpLoXjVpN5+Ht0s/VNWIqhpa+wVGZ74kB5/nTr++cOr/hjIcgdjMokfPY8TecncevQ+DySdVWvuPGZ05k8zOW41/vmx8fJqIIcDkQD2gWZPSF0u7aEpSevYpkGj6nYi8MqqNMrB8trPmSbsBNgfau0Smv9ce2Byk3eBsZ80Dy6qNsoHiou/US+6oIjIcQeq5FqlHhiPcUUV8p16C4qIBZn1cC9UdZz3r9QIoiEXdMT6uhcCsYUAYYM9GU07C8ezj5IZyAfVIOI6NphywZ6C5ZfPlRjixoHoeg7E3PGfR85hwYkFtvtyA5pYRKdWBzcL8isXkEnwXZOiKE+mf+S6YXFKYX7HApkipbrIgrUo0XR1b2ghQdZqcACmI6S9SNDkBVTe2tBFINF2ltb96kcRBojz4MA06zv8AtU5S9/oAvqAAAAAASUVORK5CYII='

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

function resetOnNewRun(run: Run): void {
  if (watching === run.startedAt) return
  watching = run.startedAt
  announced.clear()
  lastBadge = null
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

  const failed = run.items.filter((i) => i.status === 'failed')
  const waiting = anyoneWaiting(run.items)

  const badge: Alert = failed.length > 0 ? 'failed' : waiting ? 'waiting' : null
  if (badge !== lastBadge) {
    lastBadge = badge
    if (badge === null) {
      window.setOverlayIcon(null, '')
    } else {
      const url = badge === 'failed' ? BADGE_FAILED : BADGE_WAITING
      const label = badge === 'failed' ? 'Algo falhou' : 'Precisa de você'
      window.setOverlayIcon(nativeImage.createFromDataURL(url), label)
    }
  }

  if (window.isFocused() && !window.isMinimized()) return

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
