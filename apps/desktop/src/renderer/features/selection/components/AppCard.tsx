import { LuBan } from 'react-icons/lu'
import { formatMb } from '@pulse/domain'
import type { Program } from '@pulse/domain'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import s from './AppCard.module.css'

interface Props {
  program: Program
  selected: boolean
  installed: boolean
  chosenDrive: string | null
  settingsSummary: string | null
  blocked?: boolean
  onToggle: (id: string) => void
  onOpenSettings: (id: string) => void
}

export function AppCardSkeleton() {
  return (
    <div className={s.card} data-skeleton="true" aria-hidden>
      <span className={s.box} />
      <span className={s.emptyTile} />
      <span className={s.body}>
        <span className={s.nameBar} />
        <span className={s.metaBar} />
      </span>
    </div>
  )
}

export function AppCard({
  program,
  selected,
  installed,
  chosenDrive,
  settingsSummary,
  blocked = false,
  onToggle,
  onOpenSettings,
}: Props) {
  const checked = !blocked && (installed || selected)
  const note = settingsSummary ?? (chosenDrive ? `vai para o disco ${chosenDrive}` : null)

  return (
    <div
      className={s.card}
      data-installed={installed}
      data-checked={checked}
      data-blocked={blocked}
    >
      <div className={s.row}>
        <button
          type="button"
          role="checkbox"
          aria-checked={checked}
          aria-disabled={installed}
          className={s.target}
          disabled={installed}
          onClick={() => onToggle(program.id)}
        >
          <span className={s.box} aria-hidden>
            {blocked ? <LuBan size={11} /> : checked ? '✓' : ''}
          </span>

          <AppIcon id={program.id} name={program.name} size={27} />

          <span className={s.body}>
            <span className={s.name}>{program.name}</span>
            <span className={s.meta}>
              {installed
                ? 'já está no seu PC'
                : program.source === 'pages'
                  ? 'você escolhe quais baixar'
                  : blocked
                    ? formatMb(program.mb)
                    : `${program.version} · ${formatMb(program.mb)}`}
            </span>
          </span>
        </button>

        {blocked && (
          <span className={s.tag} title="Bloqueado pelo controle dos pais">
            BLOQUEADO
          </span>
        )}

        <button
          type="button"
          className={s.settings}
          data-tour={`ajustes-${program.id}`}
          aria-label={`Ajustes do ${program.name}`}
          title="Ajustes deste programa"
          onClick={() => onOpenSettings(program.id)}
        >
          ⋯
        </button>
      </div>

      {note && <div className={s.badge}>{note}</div>}
    </div>
  )
}
