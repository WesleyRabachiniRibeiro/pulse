import { useMemo, useState } from 'react'
import {
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuExternalLink,
  LuPlus,
  LuRotateCw,
  LuSearch,
  LuTriangleAlert,
} from 'react-icons/lu'
import { getProgram } from '@shared/domain/catalog'
import type { Upgrade } from '@shared/domain/inventory'
import {
  filterInstalled,
  selectable,
  type InstalledFilter,
  type InstalledNode,
} from '@shared/domain/installed'
import {
  HISTORY_LIMIT,
  RUN_STATE_LABEL,
  RUN_STATE_ONE,
  RUN_STATES,
  runSeconds,
  tallyOf,
  type RunRecord,
} from '@shared/domain/history'
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
import { useHistory, useHistoryLoaded, useWatchHistory } from '../store/useHistory'
import { bridge } from '@/shared/lib/bridge'
import s from './Manage.module.css'

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
          aria-label={busy ? 'Lendo o PC' : 'Ler o PC de novo'}
          title={busy ? 'Lendo o PC…' : 'Ler o PC de novo'}
        >
          <LuRotateCw size={15} data-busy={busy} aria-hidden />
        </button>
      </div>

      <div className={s.list}>
        {tab === 'installed' && (
          <Installed loaded={loaded} onQueue={(ids) => void enfileirar(ids)} />
        )}
        {tab === 'updates' && (
          <Updates loaded={loaded} onUpdate={(id) => void enfileirar([id])} />
        )}
        {tab === 'startup' && <Startup entries={startup} loaded={startupLoaded} />}
        {tab === 'history' && <History />}
      </div>
    </div>
  )
}

const FILTERS: { id: InstalledFilter; label: string }[] = [
  { id: 'all', label: 'TUDO' },
  { id: 'pulse', label: 'PELO PULSE' },
  { id: 'stranger', label: 'FORA DO CATÁLOGO' },
]

interface InstalledProps {
  loaded: boolean
  onQueue: (ids: readonly string[]) => void
}

function Installed({ loaded, onQueue }: InstalledProps) {
  const inventory = useInventory()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<InstalledFilter>('all')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [asking, setAsking] = useState(false)

  const shown = useMemo(
    () => filterInstalled(inventory.installed, query, filter),
    [inventory.installed, query, filter],
  )

  const canPick = selectable(shown)
  const allOn = canPick.length > 0 && canPick.every((node) => picked.has(node.key))
  const chosen = shown.filter((node) => picked.has(node.key))
  const updatable = chosen.filter((node) =>
    inventory.upgrades.some((up) => up.programId === node.programId),
  )

  function toggle(key: string) {
    setAsking(false)
    setPicked((old) => {
      const next = new Set(old)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function toggleAll() {
    setAsking(false)
    setPicked(allOn ? new Set() : new Set(canPick.map((node) => node.key)))
  }

  function removeChosen() {
    for (const node of chosen) if (node.programId) void uninstallProgram(node.programId)
    setPicked(new Set())
    setAsking(false)
  }

  if (!loaded) return <p className={s.empty}>Lendo o que está instalado neste PC…</p>
  if (inventory.installed.length === 0) {
    return <p className={s.empty}>Não consegui ler a lista de programas deste PC.</p>
  }

  return (
    <>
      <div className={s.tools}>
        <div className={s.search}>
          <LuSearch className={s.magnifier} size={15} aria-hidden />
          <input
            className={s.searchInput}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar entre os programas do PC…"
            aria-label="Buscar entre os programas do PC"
          />
          <span className={s.searchNote}>
            {shown.length} de {inventory.installed.length}
          </span>
        </div>

        {FILTERS.map((one) => (
          <button
            key={one.id}
            type="button"
            className={s.filter}
            aria-pressed={filter === one.id}
            onClick={() => setFilter(one.id)}
          >
            {one.label}
          </button>
        ))}
      </div>

      {canPick.length > 0 && (
        <div className={s.batch} data-on={picked.size > 0}>
          <button
            type="button"
            className={s.check}
            role="checkbox"
            aria-checked={allOn}
            aria-label="Marcar todos"
            onClick={toggleAll}
          >
            {allOn ? '✓' : ''}
          </button>

          <span className={s.batchLine}>
            {picked.size === 0
              ? `marque para agir em vários de uma vez · ${canPick.length} podem ser marcados`
              : `${picked.size} ${picked.size === 1 ? 'marcado' : 'marcados'}`}
          </span>

          {picked.size > 0 && !asking && (
            <>
              {updatable.length > 0 && (
                <button
                  type="button"
                  className={s.action}
                  onClick={() => onQueue(updatable.map((node) => node.programId as string))}
                >
                  ATUALIZAR {updatable.length}
                </button>
              )}

              <button
                type="button"
                className={s.action}
                data-tone="danger"
                onClick={() => setAsking(true)}
              >
                DESINSTALAR {picked.size}
              </button>

              <button type="button" className={s.action} onClick={() => setPicked(new Set())}>
                LIMPAR
              </button>
            </>
          )}

          {asking && (
            <>
              <span className={s.asking}>
                tirar {picked.size} {picked.size === 1 ? 'programa' : 'programas'} deste PC?
              </span>
              <button
                type="button"
                className={s.action}
                data-tone="danger"
                onClick={removeChosen}
              >
                SIM, TIRAR
              </button>
              <button type="button" className={s.action} onClick={() => setAsking(false)}>
                CANCELAR
              </button>
            </>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className={s.empty}>Nenhum programa com esse nome.</p>
      ) : (
        shown.map((node) => (
          <InstalledRow
            key={node.key}
            node={node}
            picked={picked.has(node.key)}
            onPick={toggle}
          />
        ))
      )}

      {inventory.hidden > 0 && filter !== 'stranger' && (
        <p className={s.hiddenNote}>
          {inventory.hidden} {inventory.hidden === 1 ? 'item ficou' : 'itens ficaram'} de fora:
          peças do Windows, componentes que vêm junto de um programa e coisas sem como desinstalar.
          São as mesmas que o Windows não mostra em Aplicativos instalados.
        </p>
      )}
    </>
  )
}

type AdoptState = 'idle' | 'working' | 'added' | 'missing' | 'failed'

const ADOPT_TITLE: Record<AdoptState, string> = {
  idle: 'Pôr no seu catálogo, para poder instalar este programa em outro PC',
  working: 'Procurando este programa no winget…',
  added: 'Entrou no seu catálogo',
  missing: 'O winget não conhece este programa, então o Pulse não teria como instalá-lo',
  failed: 'Não deu para pôr no catálogo. Tente de novo.',
}

function AdoptButton({ node }: { node: InstalledNode }) {
  const [state, setState] = useState<AdoptState>('idle')

  async function adopt() {
    setState('working')

    const answer = await bridge
      .invoke('catalog:add', {
        name: node.name,
        ...(node.version ? { version: node.version } : {}),
      })
      .catch(() => null)

    if (!answer) return setState('failed')

    if (answer.status === 'added' || answer.status === 'exists') {
      setState('added')
      void reloadInventory(true)
      return
    }

    setState(answer.status === 'not-found' ? 'missing' : 'failed')
  }

  return (
    <button
      type="button"
      className={s.icon}
      data-state={state}
      disabled={state === 'working' || state === 'added'}
      onClick={() => void adopt()}
      aria-label={`Pôr ${node.name} no seu catálogo`}
      title={ADOPT_TITLE[state]}
    >
      {state === 'added' && <LuCheck size={15} />}
      {state === 'working' && <LuRotateCw size={15} data-busy="true" />}
      {state === 'missing' && <LuTriangleAlert size={15} />}
      {(state === 'idle' || state === 'failed') && <LuPlus size={15} />}
    </button>
  )
}

function when(record: RunRecord): string {
  const started = new Date(record.startedAt)
  const finished = new Date(record.finishedAt)
  const day = started.toLocaleDateString('pt-BR')
  const from = started.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  const to = finished.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return `${day} ${from} → ${to}`
}

function howLong(seconds: number): string {
  if (seconds < 60) return `${seconds} s`
  return `${Math.max(1, Math.round(seconds / 60))} min`
}

function Run({ record, index }: { record: RunRecord; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const many = record.items.length

  return (
    <div className={s.run}>
      <button
        type="button"
        className={s.runHead}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={s.runCaret} aria-hidden>
          {open ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
        </span>

        <span className={s.runTitles}>
          <span className={s.runWhen}>{when(record)}</span>
          <span className={s.runMeta}>
            {many} {many === 1 ? 'programa' : 'programas'} · disco {record.drive} ·{' '}
            {howLong(runSeconds(record))}
          </span>
        </span>

        <span className={s.runPills}>
          {tallyOf(record).map((one) => (
            <span key={one.state} className={s.runPill} data-state={one.state}>
              {one.count} {one.count === 1 ? RUN_STATE_ONE[one.state] : RUN_STATE_LABEL[one.state]}
            </span>
          ))}
        </span>
      </button>

      {open && (
        <div className={s.runBody}>
          {record.items.map((item) => {
            const program = getProgram(item.id)
            const state = RUN_STATES.find((one) => one === item.status)

            return (
              <div key={item.id} className={s.runItem}>
                <div className={s.runLine}>
                  {program ? (
                    <AppIcon id={program.id} name={program.name} size={26} />
                  ) : (
                    <span className={s.stranger}>—</span>
                  )}

                  <span className={s.runName}>{program?.name ?? item.id}</span>
                  <span className={s.runDisk}>disco {item.drive}</span>
                  <span className={s.runTag} data-state={state ?? 'canceled'}>
                    {state ? RUN_STATE_ONE[state].toUpperCase() : item.status.toUpperCase()}
                  </span>
                </div>

                {item.error && <div className={s.runError}>{item.error}</div>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function History() {
  const runs = useHistory()
  const loaded = useHistoryLoaded()

  if (!loaded) return <p className={s.empty}>Lendo as filas que já rodaram…</p>
  if (runs.length === 0) {
    return (
      <p className={s.empty}>
        Nenhuma fila terminou ainda neste PC. Quando a primeira terminar, ela aparece aqui.
      </p>
    )
  }

  return (
    <>
      <p className={s.histLine}>
        {runs.length === 1
          ? 'A última fila que rodou neste PC.'
          : `As ${runs.length} filas mais recentes deste PC.`}{' '}
        O Pulse guarda as {HISTORY_LIMIT} últimas.
      </p>

      <div className={s.runs}>
        {runs.map((record, index) => (
          <Run key={`${record.finishedAt}-${index}`} record={record} index={index} />
        ))}
      </div>
    </>
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

interface RowProps {
  node: InstalledNode
  picked: boolean
  onPick: (key: string) => void
}

function InstalledRow({ node, picked, onPick }: RowProps) {
  const [open, setOpen] = useState(false)
  const program = node.programId ? getProgram(node.programId) : undefined
  const canOpen = useCanOpen(node.programId ?? '')
  const opening = useOpening(node.programId ?? '')
  const removing = useUninstalling(node.programId ?? '')
  const removed = useUninstalled(node.programId ?? '')
  const nested = node.children.length > 0

  return (
    <>
      <div className={s.item} data-kind={node.kind} data-picked={picked}>
        {node.programId ? (
          <button
            type="button"
            className={s.check}
            role="checkbox"
            aria-checked={picked}
            aria-label={`Marcar ${node.name}`}
            onClick={() => onPick(node.key)}
          >
            {picked ? '✓' : ''}
          </button>
        ) : (
          <span className={s.check} data-empty="true" aria-hidden />
        )}

        {nested ? (
          <button
            type="button"
            className={s.disclosure}
            aria-expanded={open}
            aria-label={open ? `Fechar ${node.name}` : `Abrir ${node.name}`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <LuChevronDown size={14} /> : <LuChevronRight size={14} />}
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
                className={s.icon}
                disabled={opening}
                onClick={() => void openProgram(program.id)}
                aria-label={`Abrir ${program.name}`}
                title={opening ? 'Abrindo…' : 'Abrir'}
              >
                <LuExternalLink size={15} />
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
            <AdoptButton node={node} />
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
