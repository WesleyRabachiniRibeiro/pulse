import { useState } from 'react'
import { getProgram } from '@shared/domain/catalog'
import type { StartupEntry } from '@shared/domain/windows'
import {
  reloadInventory,
  useInventory,
  useInventoryBusy,
  useInventoryLoaded,
} from '@/features/catalog'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import {
  setStartup,
  useStartup,
  useStartupBusy,
  useStartupLoaded,
  useWatchStartup,
} from '../store/useStartup'
import s from './Manage.module.css'

type Tab = 'installed' | 'updates' | 'startup'

export function Manage() {
  const [tab, setTab] = useState<Tab>('installed')
  const inventory = useInventory()
  const loaded = useInventoryLoaded()
  const busy = useInventoryBusy()
  const startup = useStartup()
  const startupLoaded = useStartupLoaded()

  useWatchStartup(true)

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'installed', label: 'INSTALADOS', count: inventory.apps.length },
    { id: 'updates', label: 'ATUALIZAÇÕES', count: inventory.upgrades.length },
    { id: 'startup', label: 'INICIALIZAÇÃO', count: startup.length },
  ]

  return (
    <div className={s.screen}>
      <div className={s.eyebrow}>SEMPRE DISPONÍVEL</div>
      <h2 className={s.title}>Gerenciamento</h2>
      <p className={s.subtitle}>
        O que já está neste PC, o que tem versão nova esperando, e o que abre junto com o Windows.
        Este é o lugar para onde se volta depois que a instalação terminou.
      </p>

      <div className={s.bar}>
        {tabs.map((one) => (
          <button
            key={one.id}
            type="button"
            className={s.tab}
            aria-pressed={tab === one.id}
            onClick={() => setTab(one.id)}
          >
            {one.label}
            <span className={s.tabCount}>{one.count}</span>
          </button>
        ))}

        <span className={s.spacer} />

        <button
          type="button"
          className={s.refresh}
          disabled={busy}
          onClick={() => void reloadInventory(true)}
        >
          {busy ? 'LENDO O PC…' : 'LER O PC DE NOVO'}
        </button>
      </div>

      <div className={s.list}>
        {tab === 'installed' && <Installed loaded={loaded} />}
        {tab === 'updates' && <Updates loaded={loaded} />}
        {tab === 'startup' && <Startup entries={startup} loaded={startupLoaded} />}
      </div>
    </div>
  )
}

function Installed({ loaded }: { loaded: boolean }) {
  const inventory = useInventory()

  if (!loaded) return <p className={s.empty}>Lendo o que está instalado neste PC…</p>
  if (inventory.apps.length === 0) {
    return <p className={s.empty}>Não consegui ler a lista de programas deste PC.</p>
  }

  return (
    <>
      {inventory.apps.map((app) => {
        const program = app.programId ? getProgram(app.programId) : undefined
        return (
          <div key={app.name} className={s.item}>
            {program ? (
              <AppIcon id={program.id} name={program.name} size={28} />
            ) : (
              <span className={s.stranger}>—</span>
            )}

            <span className={s.body}>
              <span className={s.name}>{app.name}</span>
              <span className={s.note}>
                {app.wingetId ?? (program ? 'do catálogo do Pulse' : 'fora do catálogo do Pulse')}
              </span>
            </span>
          </div>
        )
      })}
    </>
  )
}

function Updates({ loaded }: { loaded: boolean }) {
  const inventory = useInventory()

  if (!loaded) return <p className={s.empty}>Perguntando ao winget quem tem versão nova…</p>
  if (inventory.upgrades.length === 0) {
    return <p className={s.empty}>Nenhum programa deste PC tem versão nova esperando.</p>
  }

  return (
    <>
      {inventory.upgrades.map((upgrade) => (
        <div key={upgrade.wingetId} className={s.item}>
          <span className={s.body}>
            <span className={s.name}>{upgrade.name}</span>
            <span className={s.note}>{upgrade.wingetId}</span>
          </span>

          <span className={s.versions}>
            {upgrade.current}
            <span className={s.arrow}>→</span>
            <span className={s.fresh}>{upgrade.available}</span>
          </span>
        </div>
      ))}
    </>
  )
}

function Startup({ entries, loaded }: { entries: readonly StartupEntry[]; loaded: boolean }) {
  if (!loaded) return <p className={s.empty}>Lendo o que abre junto com o Windows…</p>
  if (entries.length === 0) {
    return <p className={s.empty}>Nada se cadastrou para abrir junto com o Windows.</p>
  }

  return (
    <>
      {entries.map((entry) => (
        <StartupItem key={entry.name} entry={entry} />
      ))}
    </>
  )
}

function StartupItem({ entry }: { entry: StartupEntry }) {
  const busy = useStartupBusy(entry.name)
  const program = entry.programId ? getProgram(entry.programId) : undefined

  return (
    <div className={s.item}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={28} />
      ) : (
        <span className={s.stranger}>—</span>
      )}

      <span className={s.body}>
        <span className={s.name}>{program?.name ?? entry.name}</span>
        <span className={s.note}>{entry.value || entry.name}</span>
      </span>

      <button
        type="button"
        className={s.toggle}
        data-on={entry.enabled}
        disabled={busy}
        onClick={() => void setStartup(entry.name, !entry.enabled)}
      >
        {busy ? 'MUDANDO…' : entry.enabled ? 'ABRE' : 'NÃO ABRE'}
      </button>
    </div>
  )
}
