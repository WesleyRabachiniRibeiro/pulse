import { runtimeToolsFor } from '@shared/domain/runtime'
import type { AnyStep, StepId, Steps } from '@shared/domain/steps'
import s from '../panels.module.css'
import { OptionListPanel } from './OptionListPanel'
import { SteamGamesPanel } from './SteamGamesPanel'
import { BrowserDefaultPanel } from './BrowserDefaultPanel'
import { GitConfigPanel } from './GitConfigPanel'
import { panelFor, type AnyPanel } from './panel'

const PANELS: Readonly<Record<StepId, AnyPanel>> = {
  vscodeExtensions: panelFor(OptionListPanel),
  editorTweaks: panelFor(OptionListPanel),
  runtimePackages: panelFor(OptionListPanel),
  vsWorkloads: panelFor(OptionListPanel),
  tibiaPages: panelFor(OptionListPanel),
  riotProducts: panelFor(OptionListPanel),
  steamGames: panelFor(SteamGamesPanel),
  browserDefault: panelFor(BrowserDefaultPanel),
  gitConfig: panelFor(GitConfigPanel),
}

interface Props {
  step: AnyStep
  programId: string
  steps: Steps | undefined
  onChangeSteps: (steps: Steps) => void
}

export function StepSection({ step, programId, steps, onChangeSteps }: Props) {
  const Panel = PANELS[step.id as StepId]
  if (!Panel) return null

  const bag = (steps ?? {}) as Record<string, unknown>
  const value = bag[step.id] as never

  const note = step.id === 'runtimePackages' ? runtimeToolsFor(programId)?.note : undefined

  return (
    <section className={s.section} data-tour="aj-kind">
      <div className={s.label}>{step.title}</div>
      <p className={s.description}>{note ?? step.description}</p>

      <Panel
        step={step}
        programId={programId}
        value={value}
        onChange={((next: unknown) => {
          const kept = { ...bag }
          if (next === undefined) delete kept[step.id]
          else kept[step.id] = next
          onChangeSteps(kept as Steps)
        }) as never}
      />
    </section>
  )
}
