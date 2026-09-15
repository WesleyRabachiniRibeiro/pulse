import { formatGb, type Drive } from '@pulse/domain'
import s from './DrivePicker.module.css'

interface Props {
  drives: readonly Drive[]
  chosen: string | null
  onChoose: (letter: string) => void
  disabled?: boolean
}

function usedPercent(drive: Drive): number {
  if (drive.totalBytes <= 0) return 0
  const used = ((drive.totalBytes - drive.freeBytes) / drive.totalBytes) * 100
  return Math.min(100, Math.max(0, Math.round(used)))
}

function fillOf(used: number): string {
  if (used >= 92) return 'var(--blocker)'
  if (used >= 80) return 'var(--warning)'
  return 'var(--grad-button)'
}

export function DrivePicker({ drives, chosen, onChoose, disabled }: Props) {
  const single = drives.length === 1

  return (
    <div className={s.block} data-tour="discos">
      <div className={s.label}>ONDE OS PROGRAMAS VÃO FICAR</div>

      <div className={s.list}>
        {drives.map((d) => {
          const used = usedPercent(d)

          return (
            <button
              key={d.letter}
              className={s.drive}
              aria-pressed={d.letter === chosen}
              disabled={disabled || single}
              onClick={() => onChoose(d.letter)}
              title={`${formatGb(d.freeBytes)} livres de ${formatGb(d.totalBytes)}`}
            >
              <span className={s.head}>
                <span className={s.letter}>{d.letter}</span>
                <span className={s.name}>{d.label || 'Sem nome'}</span>
                {d.media !== 'Desconhecido' && <span className={s.badge}>{d.media}</span>}
                {d.system && <span className={s.badge}>SISTEMA</span>}
              </span>

              <span className={s.space}>{formatGb(d.freeBytes)} livres</span>

              <span className={s.bar} aria-hidden>
                <span className={s.fill} style={{ width: `${used}%`, background: fillOf(used) }} />
              </span>
            </button>
          )
        })}
      </div>

      <p className={s.notice}>
        {single
          ? 'Este é o único disco do computador, então tudo vai para ele.'
          : 'Vale como padrão para todos os programas, e cada um pode fugir dele na própria tela. Alguns instaladores ignoram a escolha e vão sempre para o disco do sistema.'}
      </p>
    </div>
  )
}

export function DrivePickerSkeleton({ count = 2 }: { count?: number }) {
  return (
    <div className={s.block}>
      <div className={s.label}>ONDE OS PROGRAMAS VÃO FICAR</div>

      <div className={s.list} aria-busy="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className={`${s.drive} ${s.ghost}`} aria-hidden>
            <span className={s.nameBar} />
            <span className={s.spaceBar} />
            <span className={s.bar} />
          </div>
        ))}
      </div>

      <p className={s.notice}>Procurando os discos deste computador…</p>
    </div>
  )
}
