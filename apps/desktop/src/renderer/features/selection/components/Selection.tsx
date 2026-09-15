import { useEffect, useMemo, useState } from 'react'
import { LuSearch, LuSettings } from 'react-icons/lu'
import {
  DEFAULT_KEYS,
  formatMb,
  overriddenKeys,
  settingsAreEmpty,
  settingsSummary,
  withDefaults,
  type Request,
} from '@pulse/domain'
import {
  estimatedMinutes,
  filterCatalog,
  groupByCategory,
  requestsToAppend,
  totalSizeMb,
} from '@pulse/utils'
import { appendToQueue, startInstallation, useRun } from '@/features/installation'
import { TINTS } from '@/shared/ui/AppIcon/tints'
import { retryCatalog, useCatalog, useCatalogState } from '@/features/catalog'
import { useDefaults } from '@/features/preferences'
import { PinDialog, checkParentalPin, useParental } from '@/features/parental'
import { useTourStore } from '@/features/tour'
import { useAutostart } from '../store/useAutostart'
import { useDrives, useWatchDrives } from '../store/useDrives'
import { useInstalled, useInstalledFailed, useInstalledLoaded } from '../store/useInstalled'
import { useSelection } from '../store/useSelection'
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

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
}

function railLabel(name: string): string {
  const low = name.toLocaleLowerCase('pt-BR')
  return low.charAt(0).toLocaleUpperCase('pt-BR') + low.slice(1)
}

export function Selection({ drive, onGoToInstallation, onGoToConfig }: Props) {
  const catalog = useCatalog()
  const catalogState = useCatalogState()
  const defaults = useDefaults()
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inSettings, setInSettings] = useState<string | null>(null)
  const [freeing, setFreeing] = useState<string | null>(null)
  const [freed, setFreed] = useState<ReadonlySet<string>>(new Set())

  const selected = useSelection((st) => st.selected)
  const toggle = useSelection((st) => st.toggle)
  const setMany = useSelection((st) => st.setMany)
  const applyBundle = useSelection((st) => st.applyBundle)
  const drivesByApp = useSelection((st) => st.drives)
  const setDrive = useSelection((st) => st.setDrive)
  const settingsByApp = useSelection((st) => st.settings)
  const setSettings = useSelection((st) => st.setSettings)

  const run = useRun()
  const installed = useInstalled()
  const loaded = useInstalledLoaded()
  const installedFailed = useInstalledFailed()
  const drives = useDrives()
  const autostart = useAutostart()
  const parental = useParental()

  useWatchDrives()

  useEffect(() => {
    useTourStore.getState().setContext(inSettings ? 'settings' : 'grid')
  }, [inSettings])

  // Liberar um bloqueado vale até a janela fechar: a lista no disco não muda
  // porque alguém digitou o PIN uma vez.
  const wall = useMemo(
    () =>
      parental.on && parental.hasPin
        ? new Set(parental.blocked.filter((id) => !freed.has(id)))
        : new Set<string>(),
    [parental, freed],
  )

  const searching = search.trim().length > 0
  const found = useMemo(() => filterCatalog(catalog, search), [catalog, search])

  const countByCategory = useMemo(() => {
    const counts = new Map<string, number>()
    for (const one of found) counts.set(one.category, (counts.get(one.category) ?? 0) + 1)
    return counts
  }, [found])

  useEffect(() => {
    if (category && (countByCategory.get(category) ?? 0) === 0) setCategory(null)
  }, [countByCategory, category])

  const shown = useMemo(
    () =>
      found
        .filter((one) => category === null || one.category === category)
        .slice()
        .sort(byName),
    [found, category],
  )

  const openable = shown.filter((one) => !installed.has(one.id) && !wall.has(one.id))
  const allOn = openable.length > 0 && openable.every((one) => selected.has(one.id))
  const chosenCategory = catalog.categories.find((one) => one.id === category)
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
      catalog.programs
        .filter((one) => {
          if (installed.has(one.id)) return Boolean(settingsByApp[one.id])
          if (one.source === 'pages') return selected.has(one.id) || Boolean(settingsByApp[one.id])
          return selected.has(one.id)
        })
        .map((one) => {
          const settings = withDefaults(settingsByApp[one.id], defaults)
          return {
            id: one.id,
            drive: drivesByApp[one.id] ?? drive,
            ...(settingsAreEmpty(settings) ? {} : { settings }),
          }
        }),
    [catalog, selected, installed, drivesByApp, settingsByApp, drive, defaults],
  )

  const fresh = useMemo(() => requestsToAppend(checked, run), [checked, run])
  const totalMb = totalSizeMb(
    catalog,
    fresh.map((r) => r.id),
  )
  const nothing = fresh.length === 0
  const howMany = `${fresh.length} ${fresh.length === 1 ? 'programa' : 'programas'}`
  const repeated = checked.length - fresh.length
  const exceptions = fresh.filter(
    (r) => overriddenKeys(settingsByApp[r.id], defaults).length > 0,
  ).length

  const basket = useMemo(() => {
    const ids = new Set(fresh.map((r) => r.id))
    return groupByCategory(
      catalog,
      catalog.programs.filter((one) => ids.has(one.id)),
    )
  }, [fresh, catalog])

  function pickOrAsk(id: string) {
    // Desmarcar nunca pede PIN: tirar da fila não precisa de permissão.
    if (wall.has(id) && !selected.has(id)) return setFreeing(id)
    toggle(id)
  }

  async function freeOnce(pin: string): Promise<string | null> {
    if (!freeing) return null

    const ok = await checkParentalPin(pin)
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
    const settings = withDefaults(settingsByApp[id], defaults)
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

  const programInSettings = inSettings ? catalog.byId.get(inSettings) : undefined
  if (programInSettings) {
    return (
      <AppSettings
        program={programInSettings}
        installed={installed.has(programInSettings.id)}
        drives={drives}
        generalDrive={drive}
        defaults={defaults}
        chosenDrive={drivesByApp[programInSettings.id] ?? null}
        settings={settingsByApp[programInSettings.id] ?? {}}
        currentAutostart={autostart[programInSettings.id] ?? null}
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
            placeholder={`Buscar entre ${catalog.programs.length} programas…`}
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

          {catalog.categories.map((one) => {
            const amount = countByCategory.get(one.id) ?? 0
            return (
              <button
                key={one.id}
                type="button"
                className={s.railItem}
                aria-pressed={category === one.id}
                disabled={amount === 0}
                onClick={() => setCategory(one.id)}
              >
                <span className={s.railName} title={railLabel(one.name)}>
                  {railLabel(one.name)}
                </span>
                <span className={s.railCount}>{amount}</span>
              </button>
            )
          })}

          <div className={s.railLine} aria-hidden />

          <div data-tour="combos">
            <div className={s.railLabel}>COMBOS</div>
            {catalog.bundles.map((one) => (
              <button
                key={one.name}
                type="button"
                className={s.combo}
                onClick={() => applyBundle(one.ids.filter((id) => !installed.has(id)))}
              >
                <span className={s.railName}>{one.name}</span>
                <span className={s.railCount}>{one.ids.length}</span>
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
                onClick={() =>
                  setMany(
                    openable.map((one) => one.id),
                    !allOn,
                  )
                }
              >
                {allOn ? 'DESMARCAR TODOS' : 'MARCAR TODOS'}
              </button>
            )}
          </div>

          <div className={s.list}>
            {catalog.programs.length === 0 ? (
              <div className={s.away}>
                <p className={s.awayTitle}>
                  {catalogState.loading ? 'Buscando a lista de programas…' : 'Ops! Deu erro.'}
                </p>
                <p className={s.awayText}>
                  {catalogState.loading
                    ? 'O Pulse baixa o catálogo ao abrir. Leva um instante.'
                    : 'Verifique sua conexão com a internet. A lista de programas vem de lá, e sem ela o Pulse não sabe o que oferecer.'}
                </p>
                {!catalogState.loading && (
                  <button type="button" className={s.primary} onClick={() => void retryCatalog()}>
                    Tentar de novo
                  </button>
                )}
              </div>
            ) : shown.length === 0 ? (
              <p className={s.empty}>
                Nenhum programa com esse nome. O catálogo tem {catalog.programs.length} — tente
                parte do nome, como “chrome” ou “code”.
              </p>
            ) : (
              <div className={s.grid}>
                {loaded
                  ? shown.map((one) => (
                      <AppCard
                        key={one.id}
                        program={one}
                        selected={selected.has(one.id)}
                        installed={installed.has(one.id)}
                        chosenDrive={drivesByApp[one.id] ?? null}
                        settingsSummary={settingsSummary(settingsByApp[one.id])}
                        blocked={wall.has(one.id)}
                        onToggle={pickOrAsk}
                        onOpenSettings={setInSettings}
                      />
                    ))
                  : shown.map((one) => <AppCardSkeleton key={one.id} />)}
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
              basket.map((group) => (
                <div key={group.category.id} className={s.basketGroup}>
                  <div className={s.basketGroupName}>{group.category.name}</div>
                  {group.programs.map((one) => (
                    <div key={one.id} className={s.basketItem}>
                      <span
                        className={s.dot}
                        style={{ background: TINTS[one.id] ?? 'var(--tx-3)' }}
                        aria-hidden
                      />
                      <span className={s.basketItemName}>{one.name}</span>
                      {overriddenKeys(settingsByApp[one.id], defaults).length > 0 && (
                        <span className={s.exception} title="tem exceção">
                          EXC
                        </span>
                      )}
                      <span className={s.basketItemSize}>{formatMb(one.mb)}</span>
                      <button
                        type="button"
                        className={s.remove}
                        onClick={() => removeFromList(one.id)}
                        aria-label={`Tirar ${one.name} da lista`}
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
          extra={`${catalog.byId.get(freeing)?.name ?? freeing} está na lista de bloqueados. Com o seu PIN ele libera até o Pulse fechar.`}
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
