import { useEffect, useState } from 'react'
import type { PackageVersion } from '@shared/domain/catalog'
import { bridge } from '@/shared/lib/bridge'
import s from './AppSettings.module.css'

interface Props {
  id: string
  chosen: string | null
  onChoose: (winget: string | null) => void
}

export function PackageVersions({ id, chosen, onChoose }: Props) {
  const [versions, setVersions] = useState<PackageVersion[] | null>(null)

  useEffect(() => {
    let alive = true
    setVersions(null)
    void bridge
      .invoke('catalog:versions', { id })
      .then((list) => {
        if (alive) setVersions(list)
      })
      .catch(() => {
        if (alive) setVersions([])
      })
    return () => {
      alive = false
    }
  }, [id])

  if (versions === null) return <p className={s.empty}>Perguntando ao winget…</p>

  if (versions.length === 0) {
    return (
      <p className={s.empty}>
        Não deu para listar as versões agora. A recomendada continua valendo.
      </p>
    )
  }

  const recommended = versions.find((v) => v.recommended)

  return (
    <div className={s.options}>
      {versions.map((v) => {
        const active = chosen === null ? v.recommended : chosen === v.winget
        return (
          <button
            key={v.winget}
            type="button"
            role="radio"
            aria-checked={active}
            className={s.option}
            onClick={() => onChoose(v.recommended ? null : v.winget)}
          >
            <span className={s.box} aria-hidden>
              {active ? '✓' : ''}
            </span>
            <span className={s.optionBody}>
              <span className={s.optionName}>{v.name}</span>
              <span className={s.optionHint}>{v.version}</span>
            </span>
            {v.recommended && <span className={s.optionCategory}>RECOMENDADA</span>}
          </button>
        )
      })}

      {recommended && (
        <p className={s.chosenNote}>
          Na dúvida, fique com a recomendada: {recommended.name}. As outras existem para quem
          precisa de uma versão específica por causa de um projeto.
        </p>
      )}
    </div>
  )
}
