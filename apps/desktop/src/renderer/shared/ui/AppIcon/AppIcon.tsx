import type { CSSProperties } from 'react'
import { useCatalog } from '@/features/catalog'
import s from './AppIcon.module.css'
import { TINTS } from './tints'

// Duas pastas, porque são duas técnicas. O ícone de 'icons' é uma silhueta
// desenhada como máscara e tingida com a cor do programa; o de 'logos' tem
// cores próprias demais para virar silhueta, então vai como imagem.
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

// O ícone é resolvido aqui dentro, e não recebido por quem desenha: quem foi
// adotado do PC não tem SVG dentro do app e traz o próprio, e deixar isso a
// cargo de cada chamador fazia o ícone aparecer só na tela que lembrava de
// passá-lo.
export function AppIcon({ id, name, size = 34 }: Props) {
  const catalog = useCatalog()
  const mask = MASK_BY_ID[id]
  const tint = TINTS[id] ?? 'var(--tx-3)'
  const style = { '--tint': tint, '--side': `${size}px` } as CSSProperties

  // O logo colorido ganha da máscara; o ícone que o programa adotado trouxe
  // do PC só entra quando não existe desenho nenhum aqui dentro.
  const picture = LOGO_BY_ID[id] ?? (mask ? undefined : catalog.byId.get(id)?.icon)

  if (picture) {
    return (
      <span className={s.tile} data-own="true" style={style} aria-hidden>
        <img className={s.photo} src={picture} alt="" />
      </span>
    )
  }

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
