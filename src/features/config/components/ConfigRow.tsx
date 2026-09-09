import s from './Config.module.css'

export interface Choice {
  id: string
  label: string
}

interface Props {
  name: string
  hint: string
  choices: readonly Choice[]
  chosen: string
  busy?: boolean
  exceptions: readonly string[]
  onPick: (id: string) => void
}

export function ConfigRow({ name, hint, choices, chosen, busy, exceptions, onPick }: Props) {
  const fugindo = exceptions.length

  return (
    <div className={s.row} data-exception={fugindo > 0}>
      <div className={s.rowTop}>
        <div className={s.rowText}>
          <span className={s.rowName}>{name}</span>
          <span className={s.rowHint}>{hint}</span>
        </div>

        <div className={s.choices} role="group" aria-label={name}>
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={s.choice}
              aria-pressed={choice.id === chosen}
              disabled={busy}
              onClick={() => onPick(choice.id)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>

      {fugindo > 0 && (
        <div className={s.exception}>
          <span className={s.exceptionTag}>
            {fugindo} {fugindo === 1 ? 'EXCEÇÃO' : 'EXCEÇÕES'}
          </span>
          <span className={s.exceptionList}>{exceptions.join(', ')}</span>
        </div>
      )}
    </div>
  )
}
