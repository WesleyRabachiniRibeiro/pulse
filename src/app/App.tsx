import { useEffect, useState } from 'react'
import { formatMb, totalSizeMb } from '@shared/domain/catalog'
import { TitleBar } from '@/shared/ui/TitleBar/TitleBar'
import { StepRail } from '@/shared/ui/StepRail/StepRail'
import { Home } from '@/features/home'
import { Welcome } from '@/features/welcome'
import { Selection, useSelection, useWatchAutostart, useWatchInstalled } from '@/features/selection'
import { Installation, useRun, useWatchInstallation } from '@/features/installation'
import { Summary } from '@/features/summary'
import { Tour, useAbrirNaPrimeiraVez, useTourStore } from '@/features/tour'
import {
  savePreference,
  useLoadPreferences,
  usePreferences,
  usePreferencesLoaded,
} from '@/features/preferences'
import s from './App.module.css'

const VERSION = '0.1.0'

export function App() {
  useLoadPreferences()
  const carregado = usePreferencesLoaded()
  const prefs = usePreferences()

  if (!carregado) return <div className={s.page} />

  return <Shell driveSalvo={prefs.drive ?? null} />
}

function Shell({ driveSalvo }: { driveSalvo: string | null }) {
  const [step, setStep] = useState(0)
  const [drive, setDrive] = useState<string | null>(driveSalvo)
  const selected = useSelection((st) => st.selected)

  useWatchInstallation()
  const run = useRun()

  useWatchInstalled(run?.finishedAt ?? null)
  useWatchAutostart(run?.finishedAt ?? null)
  useAbrirNaPrimeiraVez()

  const totalMb = totalSizeMb(selected)
  const size = selected.size === 0 ? 'nada escolhido ainda' : `${formatMb(totalMb)} para baixar`

  const available = [1, ...(drive ? [2] : []), ...(run ? [3] : []), ...(run?.finishedAt ? [4] : [])]

  useEffect(() => {
    if (!drive && step === 2) setStep(1)
  }, [drive, step])

  useEffect(() => {
    if (drive && drive !== driveSalvo) void savePreference({ drive })
  }, [drive, driveSalvo])

  const telaAlvo = useTourStore((t) => t.telaAlvo)
  const disponiveis = available.join(',')

  useEffect(() => {
    if (telaAlvo === null) return
    if (telaAlvo === 0 || disponiveis.split(',').includes(String(telaAlvo))) setStep(telaAlvo)
    useTourStore.getState().pedirTela(null)
  }, [telaAlvo, disponiveis])

  return (
    <div className={s.page}>
      <div className={s.window}>
        <TitleBar version={VERSION} onHome={() => setStep(0)} />

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
            {step === 0 && <Home onStart={() => setStep(1)} />}
            {step === 1 && (
              <Welcome
                currentDrive={drive ?? undefined}
                queueOn={run && !run.finishedAt ? run.drive : null}
                onDriveReady={setDrive}
                onNext={() => setStep(2)}
              />
            )}
            {step === 2 && drive && (
              <Selection drive={drive} onGoToInstallation={() => setStep(3)} />
            )}
            {step === 3 && (
              <Installation onChooseMore={() => setStep(2)} onSeeSummary={() => setStep(4)} />
            )}
            {step === 4 && (
              <Summary onChooseMore={() => setStep(2)} onSeeInstallation={() => setStep(3)} />
            )}
          </div>
        </div>
      </div>

      <Tour />
    </div>
  )
}
