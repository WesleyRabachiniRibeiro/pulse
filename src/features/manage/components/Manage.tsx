import { useState } from 'react'
import { getProgram, getPrograms } from '@shared/domain/catalog'
import { suggestedText, type InstalledApp, type Upgrade } from '@shared/domain/inventory'
import type { StartupEntry } from '@shared/domain/windows'
import {
  reloadInventory,
  useInventory,
  useInventoryBusy,
  useInventoryLoaded,
} from '@/features/catalog'
import {
  appendToQueue,
  openProgram,
  startInstallation,
  useCanOpen,
  useOpening,
  useRun,
  useWatchOpenable,
} from '@/features/installation'
import { usePreferences } from '@/features/preferences'
import { uninstallProgram, useUninstalled, useUninstalling } from '@/features/selection'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import {
  setStartup,
  useStartup,
  useStartupBusy,
  useStartupLoaded,
  useWatchStartup,
} from '../store/useStartup'
import { bridge } from '@/shared/lib/bridge'
import s from './Manage.module.css'

type Tab = 'installed' | 'updates' | 'startup'

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
  const prefs = usePreferences()
  const run = useRun()

  useWatchStartup(true)
  useWatchOpenable(loaded)

  const atualizaveis = inventory.upgrades.filter((u) => u.programId !== undefined)

  async function enfileirar(ids: readonly string[]): Promise<void> {
    const drive = prefs.drive ?? 'C:'
    const requests = ids.map((id) => ({ id, drive }))
    if (requests.length === 0) return

    if (run) await appendToQueue(requests)
    else await startInstallation(requests, drive)
    onGoToInstallation()
  }

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

        {tab === 'updates' && atualizaveis.length > 0 && (
          <button
            type="button"
            className={s.headline}
            onClick={() => void enfileirar(atualizaveis.map((u) => u.programId as string))}
          >
            ATUALIZAR OS {atualizaveis.length} DO CATÁLOGO
          </button>
        )}

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
        {tab === 'updates' && (
          <Updates loaded={loaded} onUpdate={(id) => void enfileirar([id])} />
        )}
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
      {inventory.apps.map((app) => (
        <InstalledItem key={app.name} app={app} />
      ))}
    </>
  )
}

function SuggestButton({ app }: { app: InstalledApp }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const taken = getPrograms().map((p) => p.id)
    await bridge.invoke('system:copy', { text: suggestedText(app, taken) }).catch(() => undefined)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      className={s.action}
      onClick={() => void copy()}
      title="Copia uma entrada pronta para o catálogo do Pulse, com o resto para você preencher"
    >
      {copied ? 'COPIADO' : 'SUGERIR'}
    </button>
  )
}

function InstalledItem({ app }: { app: InstalledApp }) {
  const program = app.programId ? getProgram(app.programId) : undefined
  const canOpen = useCanOpen(app.programId ?? '')
  const opening = useOpening(app.programId ?? '')
  const removing = useUninstalling(app.programId ?? '')
  const removed = useUninstalled(app.programId ?? '')

  return (
    <div className={s.item}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={28} />
      ) : (
        <span className={s.stranger}>—</span>
      )}

      <span className={s.body}>
        <span className={s.name}>{app.name}</span>
        <span className={s.note}>
          {removed
            ? 'tirado deste PC'
            : (app.wingetId ?? (program ? 'do catálogo do Pulse' : 'fora do catálogo do Pulse'))}
        </span>
      </span>

      {!program && (
        <span className={s.actions}>
          <SuggestButton app={app} />
        </span>
      )}

      {program && !removed && (
        <span className={s.actions}>
          {canOpen && (
            <button
              type="button"
              className={s.action}
              disabled={opening}
              onClick={() => void openProgram(program.id)}
            >
              {opening ? 'ABRINDO…' : 'ABRIR'}
            </button>
          )}

          <button
            type="button"
            className={s.action}
            data-tone="danger"
            disabled={removing}
            onClick={() => void uninstallProgram(program.id)}
          >
            {removing ? 'TIRANDO…' : 'DESINSTALAR'}
          </button>
        </span>
      )}
    </div>
  )
}

interface UpdatesProps {
  loaded: boolean
  onUpdate: (programId: string) => void
}

function Updates({ loaded, onUpdate }: UpdatesProps) {
  const inventory = useInventory()

  if (!loaded) return <p className={s.empty}>Perguntando ao winget quem tem versão nova…</p>
  if (inventory.upgrades.length === 0) {
    return <p className={s.empty}>Nenhum programa deste PC tem versão nova esperando.</p>
  }

  return (
    <>
      {inventory.upgrades.map((upgrade) => (
        <UpdateItem key={upgrade.wingetId} upgrade={upgrade} onUpdate={onUpdate} />
      ))}
    </>
  )
}

function UpdateItem({ upgrade, onUpdate }: { upgrade: Upgrade; onUpdate: (id: string) => void }) {
  const program = upgrade.programId ? getProgram(upgrade.programId) : undefined

  return (
    <div className={s.item}>
      {program ? (
        <AppIcon id={program.id} name={program.name} size={28} />
      ) : (
        <span className={s.stranger}>—</span>
      )}

      <span className={s.body}>
        <span className={s.name}>{upgrade.name}</span>
        <span className={s.note}>{upgrade.wingetId}</span>
      </span>

      <span className={s.versions}>
        {upgrade.current}
        <span className={s.arrow}>→</span>
        <span className={s.fresh}>{upgrade.available}</span>
      </span>

      {program && (
        <span className={s.actions}>
          <button
            type="button"
            className={s.action}
            data-tone="main"
            onClick={() => onUpdate(program.id)}
          >
            ATUALIZAR
          </button>
        </span>
      )}
    </div>
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
