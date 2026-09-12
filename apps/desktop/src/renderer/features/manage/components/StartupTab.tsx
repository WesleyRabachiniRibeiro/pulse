import { useEffect, useState } from 'react'
import { type StartupEntry } from '@pulse/domain'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { bridge } from '@/shared/lib/bridge'
import s from './Manage.module.css'

export function StartupTab() {
  const catalog = useCatalog()
  const [entries, setEntries] = useState<readonly StartupEntry[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    void bridge
      .invoke('catalog:startup', undefined)
      .then((found) => {
        if (alive) setEntries(found)
      })
      .catch(() => {
        if (alive) setEntries([])
      })
    return () => {
      alive = false
    }
  }, [])

  // A resposta é a lista relida do registro, então a tela mostra o que o
  // Windows tem e não o que foi pedido.
  async function toggle(name: string, on: boolean) {
    setBusy(name)
    const found = await bridge.invoke('catalog:setStartup', { name, on }).catch(() => null)
    if (found) setEntries(found)
    setBusy(null)
  }

  if (entries === null) return <p className={s.empty}>Lendo o que abre com o Windows…</p>

  if (entries.length === 0) {
    return <p className={s.empty}>Nada se cadastrou para abrir junto com o Windows.</p>
  }

  const on = entries.filter((e) => e.enabled).length

  return (
    <div className={s.list}>
      <div className={s.listTop}>
        <span className={s.listCount}>
          {on} de {entries.length} {entries.length === 1 ? 'programa abre' : 'programas abrem'} com o
          Windows
        </span>
      </div>

      {entries.map((entry) => {
        const program = entry.programId ? catalog.byId.get(entry.programId) : undefined

        return (
          <button
            key={entry.name}
            type="button"
            role="switch"
            aria-checked={entry.enabled}
            className={s.tweak}
            disabled={busy !== null}
            onClick={() => void toggle(entry.name, !entry.enabled)}
          >
            {program ? (
              <AppIcon id={program.id} name={program.name} size={24} />
            ) : (
              <span className={s.noIcon} aria-hidden />
            )}

            <span className={s.tweakBody}>
              <span className={s.tweakName}>{program?.name ?? entry.name}</span>
              <span className={s.tweakHint}>{entry.value || entry.name}</span>
            </span>

            <span className={s.switch} aria-hidden>
              <span className={s.knob} />
            </span>
          </button>
        )
      })}

      <p className={s.footnote}>
        Desligar aqui não desinstala nada: o programa continua no PC, só para de abrir sozinho. O
        Windows guarda essa escolha à parte, então dá para ligar de volta quando quiser.
      </p>
    </div>
  )
}
