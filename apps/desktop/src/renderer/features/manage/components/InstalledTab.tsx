import { useMemo, useState } from 'react'
import {
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuExternalLink,
  LuListX,
  LuPlus,
  LuRotateCw,
  LuSearch,
  LuTriangleAlert,
} from 'react-icons/lu'
import { type InstalledFilter, type InstalledNode } from '@pulse/domain'
import { filterInstalled, selectable } from '@pulse/utils'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { useCatalog } from '@/features/catalog'
import { uninstallProgram, useUninstalled, useUninstalling } from '@/features/selection'
import { openProgram, useCanOpen, useOpening, useWatchOpenable } from '@/features/installation'
import { PinDialog, useParental } from '@/features/parental'
import { bridge } from '@/shared/lib/bridge'
import { useFileIcon } from '../store/useFileIcon'
import {
  dropFromCatalog,
  reloadInventory,
  useHiddenCount,
  useInstalled,
  useInventoryLoaded,
  useMine,
  useUpgrades,
} from '../store/useInventory'
import shell from './tabs.module.css'
import s from './InstalledTab.module.css'

const FILTERS: readonly { id: InstalledFilter; name: string }[] = [
  { id: 'all', name: 'TUDO' },
  { id: 'pulse', name: 'PELO PULSE' },
  { id: 'stranger', name: 'FORA DO CATÁLOGO' },
]

interface Props {
  onQueue: (ids: readonly string[]) => void
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

  return (
    [node.version ? `versão ${node.version}` : null, node.publisher].filter(Boolean).join(' · ') ||
    'sem versão informada'
  )
}

function NodeIcon({ node, size }: { node: InstalledNode; size: number }) {
  const catalog = useCatalog()
  const program = node.programId ? catalog.byId.get(node.programId) : undefined
  const url = useFileIcon(program?.icon ? undefined : node.icon)

  if (program) return <AppIcon id={program.id} name={program.name} size={size} />

  if (url) {
    return (
      <img
        className={s.fileIcon}
        style={{ width: size, height: size }}
        src={url}
        alt=""
        aria-hidden
      />
    )
  }

  return <span className={shell.stranger}>—</span>
}

type AdoptState = 'idle' | 'working' | 'added' | 'missing' | 'failed'

const ADOPT_TITLE: Record<AdoptState, string> = {
  idle: 'Pôr no seu catálogo, para poder instalar este programa em outro PC',
  working: 'Procurando este programa no winget…',
  added: 'Entrou no seu catálogo',
  missing: 'O winget não conhece este programa, então o Pulse não teria como instalá-lo',
  failed: 'Não deu para pôr no catálogo. Tente de novo.',
}

function AdoptButton({ node, icon }: { node: InstalledNode; icon: string | null }) {
  const [state, setState] = useState<AdoptState>('idle')

  async function adopt() {
    setState('working')

    const picture =
      icon ??
      (node.icon
        ? await bridge.invoke('system:icon', { path: node.icon }).catch(() => null)
        : null)

    const answer = await bridge
      .invoke('catalog:add', {
        name: node.name,
        ...(node.version ? { version: node.version } : {}),
        ...(picture ? { icon: picture } : {}),
      })
      .catch(() => null)

    if (!answer) return setState('failed')

    if (answer.status === 'added' || answer.status === 'exists') {
      setState('added')
      void reloadInventory()
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

function DropButton({ node }: { node: InstalledNode }) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button
        type="button"
        className={s.icon}
        onClick={() => setAsking(true)}
        aria-label={`Tirar ${node.name} do seu catálogo`}
        title="Tirar do seu catálogo. O programa continua instalado neste PC."
      >
        <LuListX size={15} />
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        className={shell.action}
        onClick={() => node.programId && void dropFromCatalog(node.programId)}
      >
        TIRAR DO CATÁLOGO
      </button>
      <button type="button" className={shell.action} onClick={() => setAsking(false)}>
        NÃO
      </button>
    </>
  )
}

interface RowProps {
  node: InstalledNode
  picked: boolean
  onPick: (key: string) => void
}

function Row({ node, picked, onPick }: RowProps) {
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const catalog = useCatalog()
  const mine = useMine()
  const { on, hasPin } = useParental()
  const program = node.programId ? catalog.byId.get(node.programId) : undefined
  const canOpen = useCanOpen(node.programId ?? '')
  const opening = useOpening(node.programId ?? '')
  const removing = useUninstalling(node.programId ?? '')
  const removed = useUninstalled(node.programId ?? '')
  const nested = node.children.length > 0
  const locked = on && hasPin
  const fileIcon = useFileIcon(program ? undefined : node.icon)

  return (
    <>
      <div className={shell.item} data-kind={node.kind} data-picked={picked}>
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

        <span className={shell.body}>
          <span className={shell.name}>{node.name}</span>
          <span className={shell.note}>{removed ? 'tirado deste PC' : noteOf(node)}</span>
        </span>

        <span className={s.origin} data-mine={Boolean(node.programId)}>
          {node.programId ? 'PELO PULSE' : 'FORA DO CATÁLOGO'}
        </span>

        {!program && node.kind === 'app' && (
          <span className={shell.actions}>
            <AdoptButton node={node} icon={fileIcon} />
          </span>
        )}

        {program && !removed && (
          <span className={shell.actions}>
            {node.programId && mine.has(node.programId) && <DropButton node={node} />}

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
              className={shell.action}
              data-tone="danger"
              disabled={removing}
              onClick={() => (locked ? setAsking(true) : void uninstallProgram(program.id))}
            >
              {removing ? 'TIRANDO…' : 'DESINSTALAR'}
            </button>
          </span>
        )}
      </div>

      {asking && program && (
        <PinDialog
          purpose="uninstall"
          extra={`Com o controle dos pais ligado, tirar ${program.name} deste PC pede o PIN.`}
          onDone={async (pin) => {
            const ok = await bridge.invoke('parental:check', { pin }).catch(() => false)
            if (!ok) return 'PIN incorreto.'

            setAsking(false)
            void uninstallProgram(program.id)
            return null
          }}
          onClose={() => setAsking(false)}
        />
      )}

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

export function InstalledTab({ onQueue }: Props) {
  const installed = useInstalled()
  const hidden = useHiddenCount()
  const upgrades = useUpgrades()
  const loaded = useInventoryLoaded()
  const catalog = useCatalog()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<InstalledFilter>('all')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [asking, setAsking] = useState(false)
  const [building, setBuilding] = useState(false)
  const [built, setBuilt] = useState<string | null>(null)

  const shown = useMemo(
    () => filterInstalled(installed, query, filter),
    [installed, query, filter],
  )

  useWatchOpenable(
    catalog.programs.map((one) => one.id),
    loaded,
  )

  const canPick = selectable(shown)
  const allOn = canPick.length > 0 && canPick.every((node) => picked.has(node.key))
  const chosen = shown.filter((node) => picked.has(node.key))
  const updatable = chosen.filter((node) =>
    upgrades.some((up) => up.programId === node.programId),
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

  async function buildProfile() {
    const ids = (picked.size > 0 ? chosen : selectable(installed))
      .map((node) => node.programId)
      .filter((id): id is string => typeof id === 'string')

    if (ids.length === 0) return

    setBuilding(true)
    const answer = await bridge
      .invoke('profile:export', {
        format: 'pulse',
        profile: { selected: ids, drives: {}, settings: {} },
      })
      .catch(() => null)
    setBuilding(false)

    if (!answer || answer.status === 'canceled') return
    setBuilt(answer.status === 'saved' ? `Perfil salvo em ${answer.path ?? 'disco'}` : null)
  }

  function removeChosen() {
    for (const node of chosen) if (node.programId) void uninstallProgram(node.programId)
    setPicked(new Set())
    setAsking(false)
  }

  if (!loaded) return <p className={shell.empty}>Lendo o que está instalado neste PC…</p>

  if (installed.length === 0) {
    return <p className={shell.empty}>Não consegui ler a lista de programas deste PC.</p>
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
            {shown.length} de {installed.length}
          </span>
        </div>

        <button
          type="button"
          className={s.build}
          disabled={building}
          onClick={() => void buildProfile()}
          title="Gera um perfil a partir do que já está neste PC, sem você marcar nada à mão"
        >
          {building
            ? 'MONTANDO…'
            : picked.size > 0
              ? `MONTAR PERFIL COM OS ${picked.size} MARCADOS`
              : 'MONTAR PERFIL COM O QUE JÁ ESTÁ AQUI'}
        </button>

        {FILTERS.map((one) => (
          <button
            key={one.id}
            type="button"
            className={s.filter}
            aria-pressed={filter === one.id}
            onClick={() => setFilter(one.id)}
          >
            {one.name}
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
                  className={shell.action}
                  onClick={() => onQueue(updatable.map((node) => node.programId as string))}
                >
                  ATUALIZAR {updatable.length}
                </button>
              )}

              <button
                type="button"
                className={shell.action}
                data-tone="danger"
                onClick={() => setAsking(true)}
              >
                DESINSTALAR {picked.size}
              </button>

              <button type="button" className={shell.action} onClick={() => setPicked(new Set())}>
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
                className={shell.action}
                data-tone="danger"
                onClick={removeChosen}
              >
                SIM, TIRAR
              </button>
              <button type="button" className={shell.action} onClick={() => setAsking(false)}>
                CANCELAR
              </button>
            </>
          )}
        </div>
      )}

      {shown.length === 0 ? (
        <p className={shell.empty}>Nenhum programa com esse nome.</p>
      ) : (
        shown.map((node) => (
          <Row key={node.key} node={node} picked={picked.has(node.key)} onPick={toggle} />
        ))
      )}

      {built && <p className={s.hiddenNote}>{built}</p>}

      {hidden > 0 && filter !== 'stranger' && (
        <p className={s.hiddenNote}>
          {hidden} {hidden === 1 ? 'item ficou' : 'itens ficaram'} de fora: peças do Windows,
          componentes que vêm junto de um programa e coisas sem como desinstalar. São as mesmas que
          o Windows não mostra em Aplicativos instalados.
        </p>
      )}
    </>
  )
}
