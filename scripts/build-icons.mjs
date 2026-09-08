import { writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import * as simpleIcons from 'simple-icons'
import { ICON_SOURCES } from './icon-sources.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const iconsDir = join(here, '..', 'src', 'shared', 'assets', 'icons')

const LIGHTNESS = [0.62, 0.78]
const SATURATION = [0.34, 0.7]
const NEUTRAL = '#B9BDC7'

const HAND_PICKED = {
  corsair: '#E2C95A',
  cursor: '#9FB2D8',
  gimp: '#C4A98F',
  inkscape: '#BFC6D6',
  notion: '#D8D5CE',
  pycharm: '#8FD46B',
  rider: '#E06BB4',
  rust: '#D9865C',
  sevenzip: '#7FA8D4',
  webstorm: '#5FC7E0',
}

function toRgb(hex) {
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255)
}

function toHsl([r, g, b]) {
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]

  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h =
    max === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6
  return [h, s, l]
}

function channel(p, q, t) {
  const x = t < 0 ? t + 1 : t > 1 ? t - 1 : t
  if (x < 1 / 6) return p + (q - p) * 6 * x
  if (x < 1 / 2) return q
  if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
  return p
}

function toHex([h, s, l]) {
  if (s === 0) {
    const v = Math.round(l * 255)
    return `#${[v, v, v].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase()}`
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const rgb = [channel(p, q, h + 1 / 3), channel(p, q, h), channel(p, q, h - 1 / 3)]
  return `#${rgb
    .map((c) => Math.round(c * 255).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase()}`
}

function clamp(value, [low, high]) {
  return Math.min(high, Math.max(low, value))
}

export function tintFor(hex) {
  const [h, s, l] = toHsl(toRgb(hex))
  if (s < 0.12) return NEUTRAL
  return toHex([h, clamp(s, SATURATION), clamp(l, LIGHTNESS)])
}

function iconFor(slug) {
  const key = `si${slug.charAt(0).toUpperCase()}${slug.slice(1)}`
  return simpleIcons[key] ?? null
}

const written = []
const kept = []
const missing = []
const tints = []

for (const [id, slug] of Object.entries(ICON_SOURCES)) {
  const icon = iconFor(slug)
  if (!icon) {
    missing.push(`${id} -> ${slug}`)
    continue
  }

  const target = join(iconsDir, `${id}.svg`)
  if (existsSync(target)) {
    kept.push(id)
  } else {
    await writeFile(target, `${icon.svg}\n`, 'utf8')
    written.push(id)
  }

  tints.push(`  ${id}: '${HAND_PICKED[id] ?? tintFor(icon.hex)}',`)
}

console.log(`escritos: ${written.length}`)
if (kept.length) console.log(`já existiam, não mexi: ${kept.join(', ')}`)
if (missing.length) console.log(`sem ícone no simple-icons: ${missing.join(', ')}`)
console.log('\ntints para src/shared/ui/AppIcon/tints.ts:\n')
console.log(tints.sort().join('\n'))
