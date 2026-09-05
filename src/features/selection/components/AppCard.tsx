import { formatMb, type Program } from '@shared/domain/catalog'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import s from './AppCard.module.css'

interface Props {
  program: Program
  selected: boolean
  installed: boolean
  chosenDrive: string | null
  settingsSummary: string | null
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
  onToggle,
  onOpenSettings,
}: Props) {
  const checked = installed || selected
  const note = settingsSummary ?? (chosenDrive ? `vai para o disco ${chosenDrive}` : null)

  return (
    <div className={s.card} data-installed={installed} data-checked={checked}>
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
            {checked ? '✓' : ''}
          </span>

          <AppIcon id={program.id} name={program.name} />

          <span className={s.body}>
            <span className={s.name}>{program.name}</span>
            <span className={s.meta}>
              {installed
                ? 'já está no seu PC'
                : program.source === 'pages'
                  ? 'você escolhe quais baixar'
                  : `${program.version} · ${formatMb(program.mb)}`}
            </span>
          </span>
        </button>

        {
}
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
