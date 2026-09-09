import { app, nativeImage } from 'electron'
import { access } from 'node:fs/promises'
import { extname } from 'node:path'

const SIDE = 32
const LIMIT = 400

const cache = new Map<string, string | null>()

/** Formatos que o Electron abre direto, sem passar pela shell do Windows. */
const IMAGES = new Set(['.ico', '.png', '.jpg', '.jpeg', '.bmp'])

function breathe(): Promise<void> {
  return new Promise((done) => setImmediate(done))
}

async function fromFile(path: string): Promise<string | null> {
  if (IMAGES.has(extname(path).toLowerCase())) {
    const image = nativeImage.createFromPath(path)
    if (!image.isEmpty()) return image.resize({ width: SIDE, height: SIDE }).toDataURL()
  }

  const icon = await app.getFileIcon(path, { size: 'normal' }).catch(() => null)
  if (!icon || icon.isEmpty()) return null

  return icon.resize({ width: SIDE, height: SIDE }).toDataURL()
}

async function resolve(path: string): Promise<string | null> {
  try {
    await access(path)
    return await fromFile(path)
  } catch {
    return null
  }
}

/**
 * Um por vez, com uma folga entre eles. A lista pede dezenas de ícones no
 * mesmo instante, e ler ícone de disco é trabalho síncrono: em rajada, a
 * janela para de responder.
 */
let queue: Promise<unknown> = Promise.resolve()

export async function readFileIcon(path: string): Promise<string | null> {
  const key = path.trim().toLowerCase()
  if (!key) return null

  const known = cache.get(key)
  if (known !== undefined) return known

  const mine = queue.then(async () => {
    const again = cache.get(key)
    if (again !== undefined) return again

    const found = await resolve(path)
    if (cache.size > LIMIT) cache.clear()
    cache.set(key, found)

    await breathe()
    return found
  })

  queue = mine.catch(() => undefined)
  return mine
}
