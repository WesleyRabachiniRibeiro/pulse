import type { CSSProperties } from 'react'
import { getProgram } from '@shared/domain/catalog'
import s from './AppIcon.module.css'
import { TINTS } from './tints'

const FILES = import.meta.glob('../../assets/icons/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

const URL_BY_ID: Record<string, string> = Object.fromEntries(
  Object.entries(FILES).map(([path, url]) => [
    path.slice(path.lastIndexOf('/') + 1, -'.svg'.length),
    url,
  ]),
)

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
  const url = URL_BY_ID[id]
  const tint = TINTS[id] ?? 'var(--tx-3)'
  const style = { '--tint': tint, '--side': `${size}px` } as CSSProperties

  if (!url) {
    // Programa adotado do PC traz a imagem que ele mesmo registrou no Windows,
    // e ela vem colorida: entra como imagem, não como máscara de uma cor só.
    const own = getProgram(id)?.icon
    if (own) {
      return (
        <span className={s.tile} data-own="true" style={style} aria-hidden>
          <img className={s.photo} src={own} alt="" />
        </span>
      )
    }
  }

  return (
    <span className={s.tile} style={style} aria-hidden>
      {url ? (
        <span
          className={s.brand}
          style={{ maskImage: `url("${url}")`, WebkitMaskImage: `url("${url}")` }}
        />
      ) : (
        <span className={s.monogram}>{monogram(name)}</span>
      )}
    </span>
  )
}
