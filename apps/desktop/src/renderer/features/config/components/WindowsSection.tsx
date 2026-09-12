import { useEffect, useState } from 'react'
import { TWEAKS, type TweakState } from '@pulse/domain'
import { bridge } from '@/shared/lib/bridge'
import s from './Config.module.css'

export function WindowsSection() {
  const [states, setStates] = useState<readonly TweakState[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('system:tweaks', undefined)
      .then((found) => {
        if (alive) setStates(found)
      })
      .catch(() => {
        if (alive) setStates([])
      })
    return () => {
      alive = false
    }
  }, [])

  // A resposta é sempre o estado relido do registro, então o que a tela mostra
  // é o que o Windows tem, e não o que a pessoa pediu.
  async function toggle(id: string, on: boolean) {
    setBusy(id)
    const found = await bridge.invoke('system:setTweak', { id, on }).catch(() => null)
    if (found) setStates(found)
    setBusy(null)
  }

  const isOn = (id: string): boolean => states?.find((t) => t.id === id)?.on === true

  return (
    <section className={s.section}>
      <div className={s.label}>AJUSTES DO WINDOWS</div>
      <p className={s.description}>
        Mudanças na sua conta do Windows, não no sistema inteiro, então não pedem administrador. O
        Pulse lê o estado de cada uma ao abrir esta tela.
      </p>

      <div className={s.tweaks}>
        {TWEAKS.map((tweak) => (
          <button
            key={tweak.id}
            type="button"
            role="switch"
            aria-checked={isOn(tweak.id)}
            className={s.tweak}
            disabled={states === null || busy !== null}
            onClick={() => void toggle(tweak.id, !isOn(tweak.id))}
          >
            <span className={s.tweakBody}>
              <span className={s.tweakName}>{tweak.name}</span>
              <span className={s.tweakHint}>{tweak.hint}</span>
            </span>
            <span className={s.switch} aria-hidden>
              <span className={s.knob} />
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}
