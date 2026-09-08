import { TWEAKS } from '@shared/domain/windows'
import { setTweak, useTweakBusy, useTweaks, useTweaksLoaded } from '../store/useTweaks'
import s from './WindowsTweaks.module.css'

export function WindowsTweaks() {
  const states = useTweaks()
  const loaded = useTweaksLoaded()

  return (
    <section className={s.group}>
      <div className={s.header}>
        <span className={s.category}>AJUSTES DO WINDOWS</span>
        <span className={s.line} aria-hidden />
      </div>

      <p className={s.note}>
        Estes não são programas, são interruptores do próprio Windows. Valem só para a sua conta,
        entram na hora e você desfaz clicando de novo. Nada aqui entra na fila.
      </p>

      <div className={s.grid}>
        {TWEAKS.map((tweak) => (
          <Tweak key={tweak.id} id={tweak.id} name={tweak.name} hint={tweak.hint} on={states[tweak.id] === true} ready={loaded} />
        ))}
      </div>
    </section>
  )
}

interface TweakProps {
  id: string
  name: string
  hint: string
  on: boolean
  ready: boolean
}

function Tweak({ id, name, hint, on, ready }: TweakProps) {
  const busy = useTweakBusy(id)

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={on}
      className={s.tweak}
      disabled={!ready || busy}
      onClick={() => void setTweak(id, !on)}
    >
      <span className={s.box} aria-hidden>
        {on ? '✓' : ''}
      </span>
      <span className={s.body}>
        <span className={s.name}>{name}</span>
        <span className={s.hint}>{busy ? 'aplicando…' : hint}</span>
      </span>
    </button>
  )
}
