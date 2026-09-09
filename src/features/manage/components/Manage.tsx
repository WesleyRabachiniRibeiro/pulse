import { useState } from 'react'
import { getProgram, getPrograms } from '@shared/domain/catalog'
import { suggestedText, type Upgrade } from '@shared/domain/inventory'
import type { InstalledNode } from '@shared/domain/installed'
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
import { useFileIcon } from '../store/useFileIcon'
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
    { id: 'installed', label: 'INSTALADOS', count: inventory.installed.length },
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
  if (inventory.installed.length === 0) {
    return <p className={s.empty}>Não consegui ler a lista de programas deste PC.</p>
  }

  return (
    <>
      {inventory.installed.map((node) => (
        <InstalledRow key={node.key} node={node} />
      ))}

      {inventory.hidden > 0 && (
        <p className={s.hiddenNote}>
          {inventory.hidden} {inventory.hidden === 1 ? 'item ficou' : 'itens ficaram'} de fora:
          peças do Windows, componentes que vêm junto de um programa e coisas sem como desinstalar.
          São as mesmas que o Windows não mostra em Aplicativos instalados.
        </p>
      )}
    </>
  )
}

function SuggestButton({ node }: { node: InstalledNode }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const taken = getPrograms().map((p) => p.id)
    const app = { name: node.name, ...(node.wingetId ? { wingetId: node.wingetId } : {}) }
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

function NodeIcon({ node, size }: { node: InstalledNode; size: number }) {
  const program = node.programId ? getProgram(node.programId) : undefined
  const url = useFileIcon(program ? undefined : node.icon)

  if (program) return <AppIcon id={program.id} name={program.name} size={size} />

  if (url) {
    return (
      <img className={s.fileIcon} style={{ width: size, height: size }} src={url} alt="" aria-hidden />
    )
  }

  return <span className={s.stranger}>—</span>
}

function noteOf(node: InstalledNode): string {
  if (node.kind === 'owner') {
    const many = node.children.length
    return `${many} ${many === 1 ? 'item sai' : 'itens saem'} junto se você remover`
  }
  if (node.kind === 'family') {
    const many = node.children.length
    return `${many} ${many === 1 ? 'versão instalada' : 'versões instaladas'}`
  }
  if (node.wingetId) return node.wingetId
  return node.programId ? 'do catálogo do Pulse' : 'fora do catálogo do Pulse'
}

function InstalledRow({ node }: { node: InstalledNode }) {
  const [open, setOpen] = useState(false)
  const program = node.programId ? getProgram(node.programId) : undefined
  const canOpen = useCanOpen(node.programId ?? '')
  const opening = useOpening(node.programId ?? '')
  const removing = useUninstalling(node.programId ?? '')
  const removed = useUninstalled(node.programId ?? '')
  const nested = node.children.length > 0

  return (
    <>
      <div className={s.item} data-kind={node.kind}>
        {nested ? (
          <button
            type="button"
            className={s.disclosure}
            aria-expanded={open}
            aria-label={open ? `Fechar ${node.name}` : `Abrir ${node.name}`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? '▾' : '▸'}
          </button>
        ) : (
          <span className={s.disclosure} aria-hidden />
        )}

        <NodeIcon node={node} size={28} />

        <span className={s.body}>
          <span className={s.name}>{node.name}</span>
          <span className={s.note}>{removed ? 'tirado deste PC' : noteOf(node)}</span>
        </span>

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

        {!program && node.kind === 'app' && (
          <span className={s.actions}>
            <SuggestButton node={node} />
          </span>
        )}
      </div>

      {open &&
        node.children.map((child) => (
          <div key={child.key} className={s.child}>
            <NodeIcon node={child} size={18} />
            <span className={s.childName}>{child.name}</span>
            {child.version && <span className={s.childVersion}>{child.version}</span>}
          </div>
        ))}
    </>
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
