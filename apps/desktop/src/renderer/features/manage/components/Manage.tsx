import { useState } from 'react'
import { LuRotateCw } from 'react-icons/lu'
import { usePreferences } from '@/features/preferences'
import { appendToQueue, startInstallation, useRun } from '@/features/installation'
import { HistoryTab } from './HistoryTab'
import { UpdatesTab } from './UpdatesTab'
import { StartupTab } from './StartupTab'
import { InstalledTab } from './InstalledTab'
import { useHistory } from '../store/useHistory'
import {
  reloadInventory,
  useInstalled,
  useInventoryBusy,
  useStartup,
  useUpgrades,
  useWatchInventory,
} from '../store/useInventory'
import s from './tabs.module.css'

type TabId = 'installed' | 'updates' | 'startup' | 'history'

interface Props {
  onGoToInstallation: () => void
}

export function Manage({ onGoToInstallation }: Props) {
  const [tab, setTab] = useState<TabId>('installed')
  const installed = useInstalled()
  const upgrades = useUpgrades()
  const startup = useStartup()
  const busy = useInventoryBusy()
  const { records } = useHistory()
  const prefs = usePreferences()
  const run = useRun()

  useWatchInventory()

  const updatable = upgrades.filter((one) => one.programId !== undefined)

  async function enqueue(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return

    const drive = prefs.drive ?? 'C:'
    const requests = ids.map((id) => ({ id, drive }))

    if (run) await appendToQueue(requests)
    else await startInstallation(requests, drive)

    onGoToInstallation()
  }

  const tabs: { id: TabId; name: string; count: number }[] = [
    { id: 'installed', name: 'INSTALADOS', count: installed.length },
    { id: 'updates', name: 'ATUALIZAÇÕES', count: upgrades.length },
    { id: 'startup', name: 'INICIALIZAÇÃO', count: startup.length },
    { id: 'history', name: 'HISTÓRICO', count: records?.length ?? 0 },
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
            {one.name}
            <span className={s.tabCount}>{one.count}</span>
          </button>
        ))}

        <span className={s.spacer} />

        {tab === 'updates' && updatable.length > 0 && (
          <button
            type="button"
            className={s.headline}
            onClick={() => void enqueue(updatable.map((one) => one.programId as string))}
          >
            ATUALIZAR OS {updatable.length} DO CATÁLOGO
          </button>
        )}

        <button
          type="button"
          className={s.refresh}
          disabled={busy}
          onClick={() => void reloadInventory()}
          aria-label={busy ? 'Lendo o PC' : 'Ler o PC de novo'}
          title={busy ? 'Lendo o PC…' : 'Ler o PC de novo'}
        >
          <LuRotateCw size={15} data-busy={busy} aria-hidden />
        </button>
      </div>

      <div className={s.list}>
        {tab === 'installed' && <InstalledTab onQueue={(ids) => void enqueue(ids)} />}
        {tab === 'updates' && <UpdatesTab onUpdate={(id) => void enqueue([id])} />}
        {tab === 'startup' && <StartupTab />}
        {tab === 'history' && <HistoryTab />}
      </div>
    </div>
  )
}
