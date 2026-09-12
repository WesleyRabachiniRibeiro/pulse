import type { Settings } from '@pulse/domain'
import { vscodeExtensions } from './vscodeExtensions'
import { editorTweaks } from './editorTweaks'
import { runtimePackages } from './runtimePackages'
import { gitConfig } from './gitConfig'
import { autostart } from './autostart'
import { steamGames } from './steamGames'
import { tibiaPages } from './tibiaPages'
import { riotProducts } from './riotProducts'
import type { StepContext, StepResult, StepRunner } from './context'

interface StepEntry {
  id: string
  valueOf: (settings: Settings) => unknown
  run: StepRunner
}

// A ordem é a que a pessoa vê acontecer, e ela importa: o Git antes da Steam
// porque a Steam pode ficar minutos esperando alguém confirmar na janela dela.
const ORDER: readonly StepEntry[] = [
  { id: 'vscodeExtensions', valueOf: (s) => s.steps?.vscodeExtensions, run: vscodeExtensions },
  { id: 'editorTweaks', valueOf: (s) => s.steps?.editorTweaks, run: editorTweaks },
  { id: 'runtimePackages', valueOf: (s) => s.steps?.runtimePackages, run: runtimePackages },
  { id: 'gitConfig', valueOf: (s) => s.steps?.gitConfig, run: gitConfig },
  { id: 'autostart', valueOf: (s) => s.autostart, run: autostart },
  { id: 'steamGames', valueOf: (s) => s.steps?.steamGames, run: steamGames },
  { id: 'tibiaPages', valueOf: (s) => s.steps?.tibiaPages, run: tibiaPages },
  { id: 'riotProducts', valueOf: (s) => s.steps?.riotProducts, run: riotProducts },
]

export const STEP_IDS: readonly string[] = ORDER.map((entry) => entry.id)

export async function runSteps(settings: Settings, ctx: StepContext): Promise<StepResult> {
  const found: StepResult = {}

  for (const entry of ORDER) {
    const value = entry.valueOf(settings)
    if (value === undefined) continue
    Object.assign(found, await entry.run(value as never, ctx))
  }

  return found
}

export type { StepContext, StepPorts, StepResult, StepRunner } from './context'
