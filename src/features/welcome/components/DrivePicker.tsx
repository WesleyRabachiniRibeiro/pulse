import { formatGb, type Drive } from '@shared/domain/preflight'
import s from './DrivePicker.module.css'

interface Props {
  drives: readonly Drive[]
  chosen: string | null
  onChoose: (letter: string) => void
  disabled?: boolean
}

export function DrivePicker({ drives, chosen, onChoose, disabled }: Props) {
  const single = drives.length === 1

  return (
    <div className={s.block} data-tour="discos">
      <div className={s.label}>ONDE INSTALAR</div>

      <div className={s.list}>
        {drives.map((d) => (
          <button
            key={d.letter}
            className={s.drive}
            aria-pressed={d.letter === chosen}
            disabled={disabled || single}
            onClick={() => onChoose(d.letter)}
          >
            <span className={s.letter}>{d.letter}</span>
            <span className={s.body}>
              <span className={s.row}>
                <span className={s.name}>{d.label || 'Sem nome'}</span>
                {d.media !== 'Desconhecido' && <span className={s.badge}>{d.media}</span>}
                {d.system && <span className={s.badge}>SISTEMA</span>}
              </span>
              <span className={s.space}>
                {formatGb(d.freeBytes)} livres de {formatGb(d.totalBytes)}
              </span>
            </span>
          </button>
        ))}
      </div>

      <p className={s.notice}>
        {single
          ? 'Este é o único disco do computador, então tudo vai para ele.'
          : 'Alguns programas ignoram essa escolha e vão sempre para o disco do sistema — é uma limitação do instalador de cada um, não do Pulse. Avisamos quais na hora de instalar.'}
      </p>
    </div>
  )
}

export function DrivePickerSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className={s.block}>
      <div className={s.label}>ONDE INSTALAR</div>

      <div className={s.list} aria-busy="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={`${s.drive} ${s.ghost}`} aria-hidden>
            <span className={s.emptyLetter} />
            <span className={s.body}>
              <span className={s.nameBar} />
              <span className={s.spaceBar} />
            </span>
          </div>
        ))}
      </div>

      <p className={s.notice}>Procurando os discos deste computador…</p>
    </div>
  )
}
