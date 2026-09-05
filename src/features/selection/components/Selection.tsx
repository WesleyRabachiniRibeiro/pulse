import { useEffect, useMemo, useState } from 'react'
import { LuSearch } from 'react-icons/lu'
import { settingsSummary } from '@shared/domain/settings'
import {
  bundleIsActive,
  BUNDLES,
  CATALOG,
  estimatedMinutes,
  filterCatalog,
  formatMb,
  groupByCategory,
  PROGRAM_BY_ID,
  totalSizeMb,
} from '@shared/domain/catalog'
import { requestsToAppend, type Request } from '@shared/domain/installation'
import { appendToQueue, startInstallation, useRun } from '@/features/installation'
import { useAutostart } from '../store/useAutostart'
import { useDrives, useWatchDrives } from '../store/useDrives'
import {
  onUninstalled,
  useInstalled,
  useInstalledFailed,
  useInstalledLoaded,
} from '../store/useInstalled'
import { useSelection } from '../store/useSelection'
import { useTourStore } from '@/features/tour'
import { AppSettings } from './AppSettings'
import { AppCard, AppCardSkeleton } from './AppCard'
import s from './Selection.module.css'

interface Props {
  drive: string
  onGoToInstallation: () => void
}

function messageOf(e: unknown): string {
  return e instanceof Error ? e.message : 'Não foi possível montar a fila.'
}

export function Selection({ drive, onGoToInstallation }: Props) {
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [inSettings, setInSettings] = useState<string | null>(null)
  const selected = useSelection((st) => st.selected)
  const toggle = useSelection((st) => st.toggle)
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

  useWatchDrives()
    useEffect(() => {
    useTourStore.getState().definirContexto(inSettings ? 'ajustes' : 'grade')
  }, [inSettings])

  const groups = useMemo(() => groupByCategory(filterCatalog(search)), [search])
  const found = useMemo(() => groups.reduce((t, g) => t + g.programs.length, 0), [groups])

  const searching = search.trim().length > 0

  const hasQueue = run !== null
  const checked: Request[] = useMemo(
    () =>
      CATALOG.filter((p) => {
        if (installed.has(p.id)) return Boolean(settingsByApp[p.id])
        if (p.source === 'pages') return selected.has(p.id) || Boolean(settingsByApp[p.id])
        return selected.has(p.id)
      }).map((p) => ({
        id: p.id,
        drive: drivesByApp[p.id] ?? drive,
        ...(settingsByApp[p.id] ? { settings: settingsByApp[p.id] } : {}),
      })),
    [selected, installed, drivesByApp, settingsByApp, drive],
  )
  const fresh = useMemo(() => requestsToAppend(checked, run), [checked, run])
  const totalMb = totalSizeMb(fresh.map((r) => r.id))
  const nothing = fresh.length === 0
  const howMany = `${fresh.length} ${fresh.length === 1 ? 'programa' : 'programas'}`
  const repeated = checked.length - fresh.length

  async function applyAlone(id: string) {
    setError(null)
    const request = { id, drive: drivesByApp[id] ?? drive, settings: settingsByApp[id] }
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

  const programInSettings = inSettings ? PROGRAM_BY_ID.get(inSettings) : undefined
  if (programInSettings) {
    return (
      <AppSettings
        program={programInSettings}
        installed={installed.has(programInSettings.id)}
        drives={drives}
        generalDrive={drive}
        chosenDrive={drivesByApp[programInSettings.id] ?? null}
        settings={settingsByApp[programInSettings.id] ?? {}}
        currentAutostart={autostart[programInSettings.id] ?? null}
        onChangeDrive={setDrive}
        onChangeSettings={setSettings}
        onUninstalled={() => onUninstalled(programInSettings.id)}
        onApplyNow={() => void applyAlone(programInSettings.id)}
        onBack={() => setInSettings(null)}
      />
    )
  }

  return (
    <div className={s.screen}>
      <header className={s.top}>
        <h2 className={s.title}>O que você quer no seu PC?</h2>

        <div className={s.search} data-tour="busca">
          <LuSearch className={s.magnifier} size={16} aria-hidden />
          <input
            className={s.searchInput}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome — Chrome, Steam, VS Code…"
            aria-label="Buscar programas"
          />
          <span className={s.count}>
            {searching ? `${found} resultados` : `${CATALOG.length} programas`}
          </span>
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

        <div className={s.bundles} data-tour="combos">
          <span className={s.bundlesLabel}>COMBOS</span>
          {BUNDLES.map((b) => (
            <button
              key={b.name}
              type="button"
              className={s.bundle}
              aria-pressed={bundleIsActive(b, selected, installed)}
              onClick={() => applyBundle(b.ids.filter((id) => !installed.has(id)))}
            >
              {b.name}
            </button>
          ))}
        </div>
      </header>

      <div className={s.list}>
        {groups.length === 0 ? (
          <p className={s.empty}>
            Nenhum programa com esse nome. O catálogo tem {CATALOG.length} — tente parte do nome,
            como “chrome” ou “code”.
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.category.id} className={s.group}>
              <div className={s.header}>
                <span className={s.category}>{g.category.name}</span>
                <span className={s.line} aria-hidden />
                <span className={s.amount}>{g.programs.length}</span>
              </div>

              <div className={s.grid}>
                {loaded
                  ? g.programs.map((p) => (
                      <AppCard
                        key={p.id}
                        program={p}
                        selected={selected.has(p.id)}
                        installed={installed.has(p.id)}
                        chosenDrive={drivesByApp[p.id] ?? null}
                        settingsSummary={settingsSummary(settingsByApp[p.id])}
                        onToggle={toggle}
                        onOpenSettings={setInSettings}
                      />
                    ))
                  : g.programs.map((p) => <AppCardSkeleton key={p.id} />)}
              </div>
            </section>
          ))
        )}
      </div>

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
                    hasQueue && repeated > 0 ? ` · ${repeated} já na fila` : ''
                  }`)}
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
