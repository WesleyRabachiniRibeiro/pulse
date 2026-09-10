import { useMemo, useState } from 'react'
import {
  LuCheck,
  LuChevronDown,
  LuChevronRight,
  LuExternalLink,
  LuListX,
  LuPlus,
  LuTriangleAlert,
  LuSearch,
  LuRotateCw,
} from 'react-icons/lu'
import { getProgram } from '@shared/domain/catalog'
import {
  filterInstalled,
  selectable,
  type InstalledFilter,
  type InstalledNode,
} from '@shared/domain/installed'
import { reloadInventory, useInventory } from '@/features/catalog'
import { openProgram, useCanOpen, useOpening } from '@/features/installation'
import { uninstallProgram, useUninstalled, useUninstalling } from '@/features/selection'
import { PinDialog, useLockedNow } from '@/features/parental'
import { AppIcon } from '@/shared/ui/AppIcon/AppIcon'
import { bridge } from '@/shared/lib/bridge'
import { useFileIcon } from '../store/useFileIcon'
import { reloadMine, useMine } from '../store/useMine'
import shell from './Manage.module.css'
import s from './InstalledTab.module.css'

const FILTERS: { id: InstalledFilter; label: string }[] = [
  { id: 'all', label: 'TUDO' },
  { id: 'pulse', label: 'PELO PULSE' },
  { id: 'stranger', label: 'FORA DO CATÁLOGO' },
]

interface InstalledProps {
  loaded: boolean
  onQueue: (ids: readonly string[]) => void
}

export function Installed({ loaded, onQueue }: InstalledProps) {
  const inventory = useInventory()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<InstalledFilter>('all')
  const [picked, setPicked] = useState<ReadonlySet<string>>(new Set())
  const [asking, setAsking] = useState(false)
  const [building, setBuilding] = useState(false)

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

  async function build() {
    const mine =
      picked.size > 0
        ? chosen.map((node) => node.programId)
        : selectable(inventory.installed).map((node) => node.programId)

    const ids = mine.filter((id): id is string => typeof id === 'string')
    if (ids.length === 0) return

    setBuilding(true)
    await bridge.invoke('profile:export', { format: 'pulse', ids }).catch(() => undefined)
    setBuilding(false)
  }

  function removeChosen() {
    for (const node of chosen) if (node.programId) void uninstallProgram(node.programId)
    setPicked(new Set())
    setAsking(false)
  }

  if (!loaded) return <p className={shell.empty}>Lendo o que está instalado neste PC…</p>
  if (inventory.installed.length === 0) {
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
            {shown.length} de {inventory.installed.length}
          </span>
        </div>

        <button
          type="button"
          className={s.build}
          disabled={building}
          onClick={() => void build()}
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

function DropButton({ node }: { node: InstalledNode }) {
  const [asking, setAsking] = useState(false)

  async function drop() {
    if (!node.programId) return
    await bridge.invoke('catalog:remove', { id: node.programId }).catch(() => undefined)
    await reloadMine()
    void reloadInventory(true)
  }

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
      <button type="button" className={shell.action} onClick={() => void drop()}>
        TIRAR DO CATÁLOGO
      </button>
      <button type="button" className={shell.action} onClick={() => setAsking(false)}>
        NÃO
      </button>
    </>
  )
}

function AdoptButton({ node }: { node: InstalledNode }) {
  const [state, setState] = useState<AdoptState>('idle')

  async function adopt() {
    setState('working')

    const answer = await bridge
      .invoke('catalog:add', {
        name: node.name,
        ...(node.version ? { version: node.version } : {}),
        ...(node.icon ? { icon: node.icon } : {}),
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


function NodeIcon({ node, size }: { node: InstalledNode; size: number }) {
  const program = node.programId ? getProgram(node.programId) : undefined
  const url = useFileIcon(program ? undefined : node.icon)

  if (program) return <AppIcon id={program.id} name={program.name} size={size} />

  if (url) {
    return (
      <img className={s.fileIcon} style={{ width: size, height: size }} src={url} alt="" aria-hidden />
    )
  }

  return <span className={shell.stranger}>—</span>
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

  return [node.version ? `versão ${node.version}` : null, node.publisher]
    .filter(Boolean)
    .join(' · ')
}

interface RowProps {
  node: InstalledNode
  picked: boolean
  onPick: (key: string) => void
}

function InstalledRow({ node, picked, onPick }: RowProps) {
  const [open, setOpen] = useState(false)
  const [asking, setAsking] = useState(false)
  const mine = useMine()
  const locked = useLockedNow()
  const program = node.programId ? getProgram(node.programId) : undefined
  const canOpen = useCanOpen(node.programId ?? '')
  const opening = useOpening(node.programId ?? '')
  const removing = useUninstalling(node.programId ?? '')
  const removed = useUninstalled(node.programId ?? '')
  const nested = node.children.length > 0

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

        {!program && node.kind === 'app' && (
          <span className={shell.actions}>
            <AdoptButton node={node} />
          </span>
        )}
      </div>

      {asking && program && (
        <PinDialog
          purpose="uninstall"
          extra={`Com o controle dos pais ligado, tirar ${program.name} deste PC pede o PIN.`}
          onDone={async (pin) => {
            const ok = await bridge
              .invoke('parental:allowOnce', { pin, id: program.id })
              .catch(() => false)
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
