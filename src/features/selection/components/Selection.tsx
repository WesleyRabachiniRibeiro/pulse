import { useEffect, useMemo, useState } from 'react'
import { LuSearch, LuSettings } from 'react-icons/lu'
import { settingsAreEmpty, settingsSummary } from '@shared/domain/settings'
import { applyDefaults, DEFAULT_KEYS, overriddenKeys } from '@shared/domain/defaults'
import {
  estimatedMinutes,
  filterCatalog,
  getProgram,
  formatMb,
  groupByCategory,
  totalSizeMb,
} from '@shared/domain/catalog'
import {
  retryCatalog,
  useBundles,
  useCatalogPhase,
  useCategories,
  useProgram,
  usePrograms,
} from '@/features/catalog'
import { requestsToAppend, type Request } from '@shared/domain/installation'
import { appendToQueue, startInstallation, useRun } from '@/features/installation'
import { TINTS } from '@/shared/ui/AppIcon/tints'
import { bridge } from '@/shared/lib/bridge'
import { useDrives, useWatchDrives } from '../store/useDrives'
import { useInstalled, useInstalledFailed, useInstalledLoaded } from '../store/useInstalled'
import { useSelection } from '../store/useSelection'
import { useTourStore } from '@/features/tour'
import { useDefaults } from '@/features/preferences'
import { PinDialog, useParental } from '@/features/parental'
import { AppSettings } from './AppSettings'
import { AppCard, AppCardSkeleton } from './AppCard'
import s from './Selection.module.css'

interface Props {
  drive: string
  onGoToInstallation: () => void
  onGoToConfig: () => void
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível montar a fila.'
}

function nameOf(id: string): string {
  return getProgram(id)?.name ?? id
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
}

function railLabel(name: string): string {
  const low = name.toLocaleLowerCase('pt-BR')
  return low.charAt(0).toLocaleUpperCase('pt-BR') + low.slice(1)
}

export function Selection({ drive, onGoToInstallation, onGoToConfig }: Props) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inSettings, setInSettings] = useState<string | null>(null)
  const selected = useSelection((st) => st.selected)
  const toggle = useSelection((st) => st.toggle)
  const applyBundle = useSelection((st) => st.applyBundle)
  const setMany = useSelection((st) => st.setMany)
  const drivesByApp = useSelection((st) => st.drives)
  const setDrive = useSelection((st) => st.setDrive)
  const settingsByApp = useSelection((st) => st.settings)
  const setSettings = useSelection((st) => st.setSettings)
  const run = useRun()
  const installed = useInstalled()
  const loaded = useInstalledLoaded()
  const installedFailed = useInstalledFailed()
  const drives = useDrives()
  const programs = usePrograms()
  const phase = useCatalogPhase()
  const categories = useCategories()
  const bundles = useBundles()
  const defaults = useDefaults()
  const parental = useParental()
  const [freeing, setFreeing] = useState<string | null>(null)
  const [freed, setFreed] = useState<ReadonlySet<string>>(new Set())

  const wall = useMemo(
    () =>
      parental.on && parental.hasPin
        ? new Set(parental.blocked.filter((id) => !freed.has(id)))
        : new Set<string>(),
    [parental, freed],
  )

  useWatchDrives()

  useEffect(() => {
    useTourStore.getState().definirContexto(inSettings ? 'ajustes' : 'grade')
  }, [inSettings])

  const searching = search.trim().length > 0
  const found = useMemo(() => filterCatalog(search), [search, programs])

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of found) counts.set(p.category, (counts.get(p.category) ?? 0) + 1)
    return counts
  }, [found])

  useEffect(() => {
    if (category && (countByCategory.get(category) ?? 0) === 0) setCategory(null)
  }, [countByCategory, category])

  const shown = useMemo(
    () =>
      found.filter((p) => category === null || p.category === category).slice().sort(byName),
    [found, category],
  )

  const openable = shown.filter((p) => !installed.has(p.id) && !wall.has(p.id))
  const allOn = openable.length > 0 && openable.every((p) => selected.has(p.id))
  const chosenCategory = categories.find((c) => c.id === category)
  const listTitle = searching
    ? 'RESULTADOS DA BUSCA'
    : (chosenCategory?.name ?? 'TODOS OS PROGRAMAS').toUpperCase()

  const defined = DEFAULT_KEYS.filter((key) => defaults[key] !== undefined)
  const defaultsLine =
    defined.length === 0
      ? 'como vierem'
      : `${defined.length} ${defined.length === 1 ? 'definido' : 'definidos'}`

  const hasQueue = run !== null
  const checked: Request[] = useMemo(
    () =>
      programs.filter((p) => {
        if (installed.has(p.id)) return Boolean(settingsByApp[p.id])
        if (p.source === 'pages') return selected.has(p.id) || Boolean(settingsByApp[p.id])
        return selected.has(p.id)
      }).map((p) => {
        const settings = applyDefaults(settingsByApp[p.id], defaults)
        return {
          id: p.id,
          drive: drivesByApp[p.id] ?? drive,
          ...(settingsAreEmpty(settings) ? {} : { settings }),
        }
      }),
    [programs, selected, installed, drivesByApp, settingsByApp, drive, defaults],
  )
  const fresh = useMemo(() => requestsToAppend(checked, run), [checked, run])
  const totalMb = totalSizeMb(fresh.map((r) => r.id))
  const nothing = fresh.length === 0
  const howMany = `${fresh.length} ${fresh.length === 1 ? 'programa' : 'programas'}`
  const repeated = checked.length - fresh.length
  const exceptions = fresh.filter(
    (r) => overriddenKeys(settingsByApp[r.id], defaults).length > 0,
  ).length

  const basket = useMemo(() => {
    const ids = new Set(fresh.map((r) => r.id))
    return groupByCategory(programs.filter((p) => ids.has(p.id)))
  }, [fresh, programs])

  function pickOrAsk(id: string) {
    if (wall.has(id)) return setFreeing(id)
    toggle(id)
  }

  async function freeOnce(pin: string): Promise<string | null> {
    if (!freeing) return null

    const ok = await bridge.invoke('parental:allowOnce', { pin, id: freeing }).catch(() => false)
    if (!ok) return 'PIN incorreto.'

    setFreed((old) => new Set([...old, freeing]))
    toggle(freeing)
    setFreeing(null)
    return null
  }

  function removeFromList(id: string) {
    if (selected.has(id)) toggle(id)
    else setSettings(id, {})
  }

  async function applyAlone(id: string) {
    setError(null)
    const settings = applyDefaults(settingsByApp[id], defaults)
    const request = {
      id,
      drive: drivesByApp[id] ?? drive,
      ...(settingsAreEmpty(settings) ? {} : { settings }),
    }
    try {
      if (hasQueue) await appendToQueue([request])
      else await startInstallation([request], drive)
      setInSettings(null)
      onGoToInstallation()
    } catch (e) {
      setError(messageOf(e))
    }
  }

  async function confirm() {
    setError(null)
    try {
      if (hasQueue) await appendToQueue(fresh)
      else await startInstallation(fresh, drive)
      onGoToInstallation()
    } catch (e) {
      setError(messageOf(e))
    }
  }

  const programInSettings = useProgram(inSettings)
  if (programInSettings) {
    return (
      <AppSettings
        program={programInSettings}
        installed={installed.has(programInSettings.id)}
        drives={drives}
        generalDrive={drive}
        chosenDrive={drivesByApp[programInSettings.id] ?? null}
        settings={settingsByApp[programInSettings.id] ?? {}}
        defaults={defaults}
        onChangeDrive={setDrive}
        onChangeSettings={setSettings}
        onApplyNow={() => void applyAlone(programInSettings.id)}
        onBack={() => setInSettings(null)}
      />
    )
  }

  return (
    <div className={s.screen}>
      <header className={s.top}>
        <div className={s.heading}>
          <div className={s.step}>PASSO 02</div>
          <h2 className={s.title}>O que você quer neste PC?</h2>
        </div>

        <div className={s.search} data-tour="busca">
          <LuSearch className={s.magnifier} size={15} aria-hidden />
          <input
            className={s.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Buscar entre ${programs.length} programas…`}
            aria-label="Buscar programas"
          />
          {searching && (
            <button
              type="button"
              className={s.clear}
              onClick={() => setSearch('')}
              aria-label="Limpar busca"
            >
              ✕
            </button>
          )}
        </div>

        <button
          type="button"
          className={s.defaults}
          onClick={onGoToConfig}
          title="Abrir a Configuração, onde ficam os padrões de todos os programas"
        >
          <LuSettings size={14} aria-hidden />
          Padrões: {defaultsLine}
        </button>
      </header>

      <div className={s.body}>
        <aside className={s.rail}>
          <div className={s.railLabel}>CATEGORIAS</div>

          <button
            type="button"
            className={s.railItem}
            aria-pressed={category === null}
            onClick={() => setCategory(null)}
          >
            <span className={s.railName}>Todos</span>
            <span className={s.railCount}>{found.length}</span>
          </button>

          {categories.map((c) => {
            const amount = countByCategory.get(c.id) ?? 0
            return (
              <button
                key={c.id}
                type="button"
                className={s.railItem}
                aria-pressed={category === c.id}
                disabled={amount === 0}
                onClick={() => setCategory(c.id)}
              >
                <span className={s.railName} title={railLabel(c.name)}>
                  {railLabel(c.name)}
                </span>
                <span className={s.railCount}>{amount}</span>
              </button>
            )
          })}

          <div className={s.railLine} aria-hidden />

          <div data-tour="combos">
            <div className={s.railLabel}>COMBOS</div>
            {bundles.map((b) => (
              <button
                key={b.name}
                type="button"
                className={s.combo}
                onClick={() => applyBundle(b.ids.filter((id) => !installed.has(id)))}
              >
                <span className={s.railName}>{b.name}</span>
                <span className={s.railCount}>{b.ids.length}</span>
              </button>
            ))}
          </div>
        </aside>

        <section className={s.main}>
          <div className={s.listHead}>
            <span className={s.listTitle}>{listTitle}</span>
            <span className={s.listCount}>{shown.length}</span>
            <span className={s.spacer} />
            {openable.length > 0 && (
              <button
                type="button"
                className={s.groupAction}
                onClick={() => setMany(openable.map((p) => p.id), !allOn)}
              >
                {allOn ? 'DESMARCAR TODOS' : 'MARCAR TODOS'}
              </button>
            )}
          </div>

          <div className={s.list}>
            {programs.length === 0 ? (
              <div className={s.away}>
                <p className={s.awayTitle}>
                  {phase === 'looking'
                    ? 'Buscando a lista de programas…'
                    : 'Ops! Ocorreu um erro.'}
                </p>
                <p className={s.awayText}>
                  {phase === 'looking'
                    ? 'O Pulse baixa o catálogo ao abrir. Leva um instante.'
                    : 'Verifique sua conexão com a internet. A lista de programas vem de lá, e sem ela o Pulse não sabe o que oferecer.'}
                </p>
                {phase !== 'looking' && (
                  <button
                    type="button"
                    className={s.primary}
                    onClick={() => void retryCatalog()}
                  >
                    Tentar de novo
                  </button>
                )}
              </div>
            ) : shown.length === 0 ? (
              <p className={s.empty}>
                Nenhum programa com esse nome. O catálogo tem {programs.length} — tente parte do
                nome, como “chrome” ou “code”.
              </p>
            ) : (
              <div className={s.grid}>
                {loaded
                  ? shown.map((p) => (
                      <AppCard
                        key={p.id}
                        program={p}
                        selected={selected.has(p.id)}
                        installed={installed.has(p.id)}
                        chosenDrive={drivesByApp[p.id] ?? null}
                        settingsSummary={settingsSummary(settingsByApp[p.id])}
                        blocked={wall.has(p.id)}
                        onToggle={pickOrAsk}
                        onOpenSettings={setInSettings}
                      />
                    ))
                  : shown.map((p) => <AppCardSkeleton key={p.id} />)}
              </div>
            )}
          </div>
        </section>

        <aside className={s.basket}>
          <div className={s.basketHead}>
            <span className={s.basketLabel}>SUA LISTA</span>
            <span className={s.basketCount}>{fresh.length}</span>
            <span className={s.spacer} />
            {fresh.length > 0 && (
              <button
                type="button"
                className={s.basketClear}
                onClick={() => setMany([...selected], false)}
              >
                LIMPAR
              </button>
            )}
          </div>

          <div className={s.basketBody}>
            {fresh.length === 0 ? (
              <p className={s.basketEmpty}>
                Sua lista está vazia. Marque programas ao lado ou use um combo para começar.
              </p>
            ) : (
              basket.map((g) => (
                <div key={g.category.id} className={s.basketGroup}>
                  <div className={s.basketGroupName}>{g.category.name}</div>
                  {g.programs.map((p) => (
                    <div key={p.id} className={s.basketItem}>
                      <span
                        className={s.dot}
                        style={{ background: TINTS[p.id] ?? 'var(--tx-3)' }}
                        aria-hidden
                      />
                      <span className={s.basketItemName}>{p.name}</span>
                      {overriddenKeys(settingsByApp[p.id], defaults).length > 0 && (
                        <span className={s.exception} title="tem exceção">
                          EXC
                        </span>
                      )}
                      <span className={s.basketItemSize}>{formatMb(p.mb)}</span>
                      <button
                        type="button"
                        className={s.remove}
                        onClick={() => removeFromList(p.id)}
                        aria-label={`Tirar ${p.name} da lista`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>

      {freeing && (
        <PinDialog
          purpose="install"
          extra={`${nameOf(freeing)} está na lista de bloqueados. Com o seu PIN ele libera até o Pulse fechar.`}
          onDone={freeOnce}
          onClose={() => setFreeing(null)}
        />
      )}

      <footer className={s.footer} data-tour="rodape">
        <div className={s.summary}>
          {error ??
            (!loaded
              ? 'vendo o que já está instalado no seu PC…'
              : nothing
                ? hasQueue && repeated > 0
                  ? 'tudo o que está marcado já foi para a fila'
                  : installedFailed
                    ? 'não deu para checar o que já está instalado — a lista veio inteira'
                    : 'nenhum programa marcado ainda'
                : `${howMany} · ${formatMb(totalMb)} · ~${estimatedMinutes(totalMb)} min${
                    exceptions > 0 ? ` · ${exceptions} com exceção` : ''
                  }${hasQueue && repeated > 0 ? ` · ${repeated} já na fila` : ''}`)}
        </div>

        <div className={s.footerActions}>
          {hasQueue && (
            <button type="button" className={s.secondary} onClick={onGoToInstallation}>
              Ver instalação
            </button>
          )}

          <button
            type="button"
            className={s.primary}
            onClick={confirm}
            disabled={nothing || !loaded}
          >
            {hasQueue
              ? nothing
                ? 'Adicionar à fila'
                : `Adicionar ${howMany} à fila`
              : nothing
                ? 'Instalar'
                : `Instalar ${howMany}`}
          </button>
        </div>
      </footer>
    </div>
  )
}
