import { useEffect, useState } from 'react'
import { formatMb } from '@pulse/domain'
import { totalSizeMb } from '@pulse/utils'
import { TitleBar } from '@/shared/ui/TitleBar/TitleBar'
import { StepRail } from '@/shared/ui/StepRail/StepRail'
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
import { useWatchParental } from '@/features/parental'
import {
  savePreference,
  useLoadPreferences,
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
  const [step, setStep] = useState(0)
  const [overlay, setOverlay] = useState<'config' | 'manage' | null>(null)
  const [drive, setDrive] = useState<string | null>(savedDrive)
  const selected = useSelection((st) => st.selected)
  const verifiedDrive = usePreflightDrive()

  useWatchCatalog()
  useWatchInstallation()
  useWatchParental()
  const run = useRun()

  const pastPreflight = step >= 2

  useWatchInstalled(run?.finishedAt ?? null, pastPreflight)
  useWatchAutostart(run?.finishedAt ?? null, pastPreflight)
  useOpenOnFirstVisit()

  const totalMb = totalSizeMb(catalog, selected)
  const size = selected.size === 0 ? 'nada escolhido ainda' : `${formatMb(totalMb)} para baixar`

  const available = [1, ...(drive ? [2] : []), ...(run ? [3] : []), ...(run?.finishedAt ? [4] : [])]

  useEffect(() => {
    if (verifiedDrive !== undefined) setDrive(verifiedDrive)
  }, [verifiedDrive])

  useEffect(() => {
    if (!drive && step === 2) setStep(1)
  }, [drive, step])

  useEffect(() => {
    if (drive && drive !== savedDrive) void savePreference({ drive })
  }, [drive, savedDrive])

  const targetScreen = useTourStore((t) => t.targetScreen)
  const availableList = available.join(',')

  useEffect(() => {
    if (targetScreen === null) return
    if (targetScreen === 0 || availableList.split(',').includes(String(targetScreen))) setStep(targetScreen)
    useTourStore.getState().requestScreen(null)
  }, [targetScreen, availableList])

  return (
    <div className={s.page}>
      <div className={s.window}>
        <TitleBar
          version={VERSION}
          onHome={() => {
            setOverlay(null)
            setStep(0)
          }}
          onConfig={() => setOverlay('config')}
          onManage={() => setOverlay('manage')}
        />

        <div className={s.inner}>
          <StepRail
            onHome={() => setStep(0)}
            atHome={step === 0}
            current={step}
            available={available}
            onGo={setStep}
            selected={selected.size}
            size={size}
          />

          <div className={s.content}>
            {overlay === 'config' && <Config onBack={() => setOverlay(null)} />}
            {overlay === 'manage' && <Manage onBack={() => setOverlay(null)} />}
            {overlay === null && step === 0 && <Home onStart={() => setStep(1)} />}
            {overlay === null && step === 1 && (
              <Welcome
                queueOn={run && !run.finishedAt ? run.drive : null}
                onNext={() => setStep(2)}
              />
            )}
            {overlay === null && step === 2 && drive && (
              <Selection drive={drive} onGoToInstallation={() => setStep(3)} />
            )}
            {overlay === null && step === 3 && (
              <Installation onChooseMore={() => setStep(2)} onSeeSummary={() => setStep(4)} />
            )}
            {overlay === null && step === 4 && (
              <Summary onChooseMore={() => setStep(2)} onSeeInstallation={() => setStep(3)} />
            )}
          </div>
        </div>
      </div>

      <Tour />
    </div>
  )
}
