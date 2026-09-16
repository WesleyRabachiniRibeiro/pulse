import logo from '@/shared/assets/logo.png'

const APPEAR = 520
const REVEAL_AT = 420
const REVEAL_TIME = 1500
const SETTLE = 620

export const SPLASH_DURATION = REVEAL_AT + REVEAL_TIME + SETTLE

const BOX_TOP = 0.58
const FEATHER = 0.22

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

export function mountScene(canvas: HTMLCanvasElement, onDone: () => void): () => void {
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    onDone()
    return () => undefined
  }

  const art = new Image()
  art.src = logo

  const layer = document.createElement('canvas')
  const layerCtx = layer.getContext('2d')

  let width = 0
  let height = 0
  let ratio = 1

  const resize = (): void => {
    const parent = canvas.parentElement
    if (!parent) return
    width = parent.clientWidth
    height = parent.clientHeight
    if (width === 0 || height === 0) return
    ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.round(width * ratio)
    canvas.height = Math.round(height * ratio)
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    layer.width = canvas.width
    layer.height = canvas.height
    layerCtx?.setTransform(ratio, 0, 0, ratio, 0, 0)
  }

  const observer = new ResizeObserver(resize)
  if (canvas.parentElement) observer.observe(canvas.parentElement)
  resize()

  let frame = 0
  let finished = false
  const started = performance.now()

  const draw = (): void => {
    frame = requestAnimationFrame(draw)
    const t = performance.now() - started

    if (width === 0 || height === 0 || !layerCtx) return
    ctx.clearRect(0, 0, width, height)

    if (!art.complete || art.naturalWidth === 0) {
      if (!finished && t >= SPLASH_DURATION) {
        finished = true
        onDone()
      }
      return
    }

    const appear = easeOutCubic(clamp01(t / APPEAR))
    const float = Math.sin(t / 900) * 4

    const size = Math.min(width, height) * mix(0.82, 0.92, appear)
    const x = (width - size) / 2
    const y = (height - size) / 2 + float + (1 - appear) * 26

    const boxTopY = y + size * BOX_TOP
    const feather = size * FEATHER
    const travel = boxTopY - y + feather

    const revealT = easeInOutCubic(clamp01((t - REVEAL_AT) / REVEAL_TIME))
    const edgeY = boxTopY - travel * revealT

    layerCtx.clearRect(0, 0, width, height)
    layerCtx.globalAlpha = appear
    layerCtx.drawImage(art, x, y, size, size)
    layerCtx.globalAlpha = 1

    layerCtx.globalCompositeOperation = 'destination-in'
    const mask = layerCtx.createLinearGradient(0, 0, 0, height)
    const soft = clamp01((edgeY - feather) / height)
    const hard = clamp01(edgeY / height)
    mask.addColorStop(0, 'rgba(0, 0, 0, 0)')
    mask.addColorStop(soft, 'rgba(0, 0, 0, 0)')
    mask.addColorStop(Math.max(soft + 0.001, hard), 'rgba(0, 0, 0, 1)')
    mask.addColorStop(1, 'rgba(0, 0, 0, 1)')
    layerCtx.fillStyle = mask
    layerCtx.fillRect(0, 0, width, height)
    layerCtx.globalCompositeOperation = 'source-over'

    ctx.drawImage(layer, 0, 0, layer.width, layer.height, 0, 0, width, height)

    const mouthY = boxTopY
    const bloom = ctx.createRadialGradient(width / 2, mouthY, 2, width / 2, mouthY, size * 0.5)
    const strength = 0.34 * appear * (0.45 + 0.55 * (1 - Math.abs(revealT * 2 - 1)))
    bloom.addColorStop(0, `rgba(140, 190, 255, ${strength})`)
    bloom.addColorStop(0.45, `rgba(124, 92, 240, ${strength * 0.5})`)
    bloom.addColorStop(1, 'rgba(124, 92, 240, 0)')
    ctx.globalCompositeOperation = 'lighter'
    ctx.fillStyle = bloom
    ctx.fillRect(0, 0, width, height)

    ctx.globalCompositeOperation = 'source-over'

    if (!finished && t >= SPLASH_DURATION) {
      finished = true
      onDone()
    }
  }

  draw()

  return () => {
    cancelAnimationFrame(frame)
    observer.disconnect()
  }
}
