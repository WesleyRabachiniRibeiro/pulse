import { useEffect, useState } from 'react'
import { formatMb, totalSizeMb } from '@shared/domain/catalog'
import { countOverrides } from '@shared/domain/defaults'
import { TitleBar } from '@/shared/ui/TitleBar/TitleBar'
import { StepRail } from '@/shared/ui/StepRail/StepRail'
import type { Screen } from '@/shared/ui/StepRail/screens'
import { Home } from '@/features/home'
import { Config } from '@/features/config'
import { BlockedList, useLoadParental } from '@/features/parental'
import { Manage } from '@/features/manage'
import {
  useUpdateCount,
  useWatchCatalog,
  useWatchInstalled,
  useWatchInventory,
} from '@/features/catalog'
import {
  Welcome,
  startPreflight,
  usePreflightDrive,
  usePreflightSettled,
  useWatchPreflight,
} from '@/features/welcome'
import {
  Selection,
  useLoadSelection,
  useSelection,
  useWatchAutostart,
} from '@/features/selection'
import { Installation, useRun, useWatchInstallation } from '@/features/installation'
import { Summary } from '@/features/summary'
import { Splash } from '@/features/splash'
import { UpdatePill, useWatchUpdate } from '@/features/updates'
import { Tour, useAbrirNaPrimeiraVez, useTourStore } from '@/features/tour'
import {
  savePreference,
  useDefaults,
  useLoadPreferences,
  usePreferences,
  usePreferencesLoaded,
} from '@/features/preferences'
import s from './App.module.css'

const VERSION = __APP_VERSION__

export function App() {
  useLoadPreferences()
  useLoadSelection()
  useLoadParental()
  useWatchCatalog()
  useWatchPreflight()
  useWatchUpdate()
  const carregado = usePreferencesLoaded()
  const prefs = usePreferences()
  const verificado = usePreflightSettled()
  const [aberturaTerminou, setAberturaTerminou] = useState(false)

  useEffect(() => {
    if (carregado) startPreflight(prefs.drive ?? undefined)
  }, [carregado, prefs.drive])

  return (
    <>
      {carregado ? <Shell driveSalvo={prefs.drive ?? null} /> : <div className={s.page} />}
      {!aberturaTerminou && (
        <Splash liberado={carregado && verificado} onDone={() => setAberturaTerminou(true)} />
      )}
    </>
  )
}

function Shell({ driveSalvo }: { driveSalvo: string | null }) {
  const [screen, setScreen] = useState<Screen>('home')
  const [blocking, setBlocking] = useState(false)
  const [drive, setDrive] = useState<string | null>(driveSalvo)
  const selected = useSelection((st) => st.selected)
  const settingsByApp = useSelection((st) => st.settings)
  const defaults = useDefaults()
  const driveVerificado = usePreflightDrive()
  const updates = useUpdateCount()

  useWatchInstallation()
  const run = useRun()

  const passouDaVerificacao = screen !== 'home' && screen !== 'check'

  useWatchInstalled(run?.finishedAt ?? null, passouDaVerificacao)
  useWatchAutostart(run?.finishedAt ?? null, passouDaVerificacao)
  useWatchInventory(run?.finishedAt ?? null, screen !== 'check')
  useAbrirNaPrimeiraVez()

  const totalMb = totalSizeMb(selected)
  const size = selected.size === 0 ? 'nada escolhido ainda' : `${formatMb(totalMb)} para baixar`

  const available: Screen[] = [
    'check',
    ...(drive ? (['select'] as const) : []),
    ...(run ? (['run'] as const) : []),
    ...(run?.finishedAt ? (['summary'] as const) : []),
    'config',
    'manage',
  ]

  useEffect(() => {
    if (driveVerificado !== undefined) setDrive(driveVerificado)
  }, [driveVerificado])

  useEffect(() => {
    if (!drive && screen === 'select') setScreen('check')
  }, [drive, screen])

  useEffect(() => {
    if (drive && drive !== driveSalvo) void savePreference({ drive })
  }, [drive, driveSalvo])

  const telaAlvo = useTourStore((t) => t.telaAlvo)
  const disponiveis = available.join(',')

  useEffect(() => {
    if (telaAlvo === null) return
    if (telaAlvo === 'home' || disponiveis.split(',').includes(telaAlvo)) setScreen(telaAlvo)
    useTourStore.getState().pedirTela(null)
  }, [telaAlvo, disponiveis])

  return (
    <div className={s.page}>
      <div className={s.window}>
        <TitleBar
          version={VERSION}
          onHome={() => setScreen('home')}
          onHelp={() => useTourStore.getState().abrir()}
          slot={<UpdatePill />}
        />

        <div className={s.inner}>
          <StepRail
            current={screen}
            available={available}
            onGo={setScreen}
            selected={selected.size}
            size={size}
            overrides={countOverrides(settingsByApp, defaults)}
            updates={updates}
          />

          <div className={s.content}>
            {screen === 'home' && (
              <Home onStart={() => setScreen('check')} onManage={() => setScreen('manage')} />
            )}
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
            {screen === 'config' && !blocking && (
              <Config
                onGoToInstallation={() => setScreen('run')}
                onOpenBlocked={() => setBlocking(true)}
              />
            )}
            {screen === 'config' && blocking && (
              <BlockedList onDone={() => setBlocking(false)} />
            )}
            {screen === 'manage' && <Manage onGoToInstallation={() => setScreen('run')} />}
          </div>
        </div>
      </div>

      <Tour />
    </div>
  )
}
