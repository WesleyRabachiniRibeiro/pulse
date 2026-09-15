import { useEffect, useState } from 'react'
import { DEFAULT_KEYS, formatMb, programsOverriding } from '@pulse/domain'
import { totalSizeMb } from '@pulse/utils'
import { TitleBar } from '@/shared/ui/TitleBar/TitleBar'
import { StepRail } from '@/shared/ui/StepRail/StepRail'
import { TRAIL, type Screen } from '@/shared/ui/StepRail/screens'
import { Home } from '@/features/home'
import {
  Welcome,
  startPreflight,
  usePreflightDrive,
  usePreflightSettled,
  useWatchPreflight,
} from '@/features/preflight'
import { Selection, useSelection, useWatchAutostart, useWatchInstalled } from '@/features/selection'
import { Installation, useRun, useWatchInstallation } from '@/features/installation'
import { Summary } from '@/features/summary'
import { Splash } from '@/features/splash'
import { Config } from '@/features/config'
import { Manage } from '@/features/manage'
import { useWatchUpdate } from '@/features/updates'
import { Tour, useOpenOnFirstVisit, useTourStore } from '@/features/tour'
import { BlockedList, useWatchParental } from '@/features/parental'
import {
  savePreference,
  useLoadPreferences,
  useDefaults,
  usePreferences,
  usePreferencesLoaded,
} from '@/features/preferences'
import { useCatalog, useWatchCatalog } from '@/features/catalog'
import s from './App.module.css'

const VERSION = __APP_VERSION__

export function App() {
  useLoadPreferences()
  useWatchPreflight()
  useWatchUpdate()
  const loaded = usePreferencesLoaded()
  const prefs = usePreferences()
  const settled = usePreflightSettled()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    if (loaded) startPreflight(prefs.drive ?? undefined)
  }, [loaded, prefs.drive])

  return (
    <>
      {loaded ? <Shell savedDrive={prefs.drive ?? null} /> : <div className={s.page} />}
      {!splashDone && (
        <Splash ready={loaded && settled} onDone={() => setSplashDone(true)} />
      )}
    </>
  )
}

function Shell({ savedDrive }: { savedDrive: string | null }) {
  const catalog = useCatalog()
  const [screen, setScreen] = useState<Screen>('home')
  const [drive, setDrive] = useState<string | null>(savedDrive)
  const selected = useSelection((st) => st.selected)
  const verifiedDrive = usePreflightDrive()

  useWatchCatalog()
  useWatchInstallation()
  useWatchParental()
  const run = useRun()

  const pastPreflight = screen === 'select' || screen === 'run' || screen === 'summary'

  useWatchInstalled(run?.finishedAt ?? null, pastPreflight)
  useWatchAutostart(run?.finishedAt ?? null, pastPreflight)
  useOpenOnFirstVisit()

  // O rail marca quantos programas fogem do padrão, contando cada um uma vez
  // só mesmo que fuja em mais de um campo.
  const defaults = useDefaults()
  const settingsByApp = useSelection((st) => st.settings)
  const overrides = new Set(
    DEFAULT_KEYS.flatMap((key) => programsOverriding(settingsByApp, defaults, key)),
  ).size

  const totalMb = totalSizeMb(catalog, selected)
  const size = selected.size === 0 ? 'nada escolhido ainda' : `${formatMb(totalMb)} para baixar`

  const available: Screen[] = [
    'check',
    ...(drive ? (['select'] as const) : []),
    ...(run ? (['run'] as const) : []),
    ...(run?.finishedAt ? (['summary'] as const) : []),
  ]

  useEffect(() => {
    if (verifiedDrive !== undefined) setDrive(verifiedDrive)
  }, [verifiedDrive])

  useEffect(() => {
    if (!drive && screen === 'select') setScreen('check')
  }, [drive, screen])

  useEffect(() => {
    if (drive && drive !== savedDrive) void savePreference({ drive })
  }, [drive, savedDrive])

  // O tour ainda pede tela por número; a trilha do TRAIL está na mesma ordem.
  const targetScreen = useTourStore((t) => t.targetScreen)
  const availableList = available.join(',')

  useEffect(() => {
    if (targetScreen === null) return
    const wanted: Screen = targetScreen === 0 ? 'home' : (TRAIL[targetScreen - 1]?.key ?? 'home')
    if (wanted === 'home' || availableList.split(',').includes(wanted)) setScreen(wanted)
    useTourStore.getState().requestScreen(null)
  }, [targetScreen, availableList])

  return (
    <div className={s.page}>
      <div className={s.window}>
        <TitleBar version={VERSION} onHome={() => setScreen('home')} />

        <div className={s.inner}>
          <StepRail
            current={screen}
            available={available}
            onGo={setScreen}
            selected={selected.size}
            size={size}
            overrides={overrides}
            updates={0}
          />

          <div className={s.content}>
            {screen === 'home' && <Home onStart={() => setScreen('check')} onManage={() => setScreen('manage')} />}
            {screen === 'check' && (
              <Welcome
                queueOn={run && !run.finishedAt ? run.drive : null}
                onNext={() => setScreen('select')}
              />
            )}
            {screen === 'select' && drive && (
              <Selection
                drive={drive}
                onGoToInstallation={() => setScreen('run')}
                onGoToConfig={() => setScreen('config')}
              />
            )}
            {screen === 'run' && (
              <Installation
                onChooseMore={() => setScreen('select')}
                onSeeSummary={() => setScreen('summary')}
              />
            )}
            {screen === 'summary' && (
              <Summary
                onChooseMore={() => setScreen('select')}
                onSeeInstallation={() => setScreen('run')}
                onGoToManage={() => setScreen('manage')}
              />
            )}
            {screen === 'config' && <Config onOpenBlocked={() => setScreen('blocked')} />}
            {screen === 'blocked' && <BlockedList onDone={() => setScreen('config')} />}
            {screen === 'manage' && <Manage onGoToInstallation={() => setScreen('run')} />}
          </div>
        </div>
      </div>

      <Tour />
    </div>
  )
}
