import type { CSSProperties } from 'react'
import { getProgram } from '@shared/domain/catalog'
import s from './AppIcon.module.css'
import { TINTS } from './tints'

const MASKS = import.meta.glob('../../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const LOGOS = import.meta.glob('../../assets/logos/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function byId(files: Record<string, string>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(files).map(([path, url]) => [
      path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
      url,
    ]),
  )
}

const MASK_BY_ID = byId(MASKS)
const LOGO_BY_ID = byId(LOGOS)

function monogram(name: string): string {
  const words = name.split(/[\s.]+/).filter(Boolean)
  const first = words[0] ?? '?'
  const second = words[1]
  return (second ? first[0]! + second[0]! : first.slice(0, 2)).toUpperCase()
}

interface Props {
  id: string
  name: string
  size?: number
}

export function AppIcon({ id, name, size = 34 }: Props) {
  const tint = TINTS[id] ?? 'var(--tx-3)'
  const style = { '--tint': tint, '--side': `${size}px` } as CSSProperties

  const picture = LOGO_BY_ID[id] ?? (MASK_BY_ID[id] ? undefined : getProgram(id)?.icon)

  if (picture) {
    return (
      <span className={s.tile} data-own="true" style={style} aria-hidden>
        <img className={s.photo} src={picture} alt="" />
      </span>
    )
  }

  const mask = MASK_BY_ID[id]

  return (
    <span className={s.tile} style={style} aria-hidden>
      {mask ? (
        <span
          className={s.brand}
          style={{ maskImage: `url("${mask}")`, WebkitMaskImage: `url("${mask}")` }}
        />
      ) : (
        <span className={s.monogram}>{monogram(name)}</span>
      )}
    </span>
  )
}
