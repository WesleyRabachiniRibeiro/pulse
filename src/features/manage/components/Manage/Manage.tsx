import { useState } from 'react'
import { LuRotateCw } from 'react-icons/lu'
import {
  reloadInventory,
  useInventory,
  useInventoryBusy,
  useInventoryLoaded,
} from '@/features/catalog'
import {
  appendToQueue,
  startInstallation,
  useRun,
  useWatchOpenable,
} from '@/features/installation'
import { usePreferences } from '@/features/preferences'
import { useStartup, useStartupLoaded, useWatchStartup } from '../../store/useStartup'
import { useWatchMine } from '../../store/useMine'
import { useHistory, useWatchHistory } from '../../store/useHistory'
import { Installed } from '../InstalledTab'
import { Updates } from '../UpdatesTab'
import { Startup } from '../StartupTab'
import { History } from '../HistoryTab'
import s from '../tabs.module.css'

type Tab = 'installed' | 'updates' | 'startup' | 'history'

interface Props {
  onGoToInstallation: () => void
}

export function Manage({ onGoToInstallation }: Props) {
  const [tab, setTab] = useState<Tab>('installed')
  const inventory = useInventory()
  const loaded = useInventoryLoaded()
  const busy = useInventoryBusy()
  const startup = useStartup()
  const startupLoaded = useStartupLoaded()
  const history = useHistory()
  const prefs = usePreferences()
  const run = useRun()
  useWatchHistory(run?.finishedAt ?? null)
  useWatchMine(loaded)

  useWatchStartup(true)
  useWatchOpenable(loaded)

  const updatable = inventory.upgrades.filter((u) => u.programId !== undefined)

  async function enqueue(ids: readonly string[]): Promise<void> {
    const drive = prefs.drive ?? 'C:'
    const requests = ids.map((id) => ({ id, drive }))
    if (requests.length === 0) return

    if (run) await appendToQueue(requests)
    else await startInstallation(requests, drive)
    onGoToInstallation()
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: 'installed', label: 'INSTALADOS', count: inventory.installed.length },
    { id: 'updates', label: 'ATUALIZAÇÕES', count: inventory.upgrades.length },
    { id: 'startup', label: 'INICIALIZAÇÃO', count: startup.length },
    { id: 'history', label: 'HISTÓRICO', count: history.length },
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

        {tab === 'updates' && updatable.length > 0 && (
          <button
            type="button"
            className={s.headline}
            onClick={() => void enqueue(updatable.map((u) => u.programId as string))}
          >
            ATUALIZAR OS {updatable.length} DO CATÁLOGO
          </button>
        )}

        <button
          type="button"
          className={s.refresh}
          disabled={busy}
          onClick={() => void reloadInventory(true)}
          aria-label={busy ? 'Lendo o PC' : 'Ler o PC de novo'}
          title={busy ? 'Lendo o PC…' : 'Ler o PC de novo'}
        >
          <LuRotateCw size={15} data-busy={busy} aria-hidden />
        </button>
      </div>

      <div className={s.list}>
        {tab === 'installed' && (
          <Installed loaded={loaded} onQueue={(ids) => void enqueue(ids)} />
        )}
        {tab === 'updates' && (
          <Updates loaded={loaded} onUpdate={(id) => void enqueue([id])} />
        )}
        {tab === 'startup' && <Startup entries={startup} loaded={startupLoaded} />}
        {tab === 'history' && <History />}
      </div>
    </div>
  )
}
