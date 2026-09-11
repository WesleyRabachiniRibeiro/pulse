import type { Settings } from '@pulse/domain'
import { vscodeExtensions } from './vscodeExtensions'
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
  { id: 'vscodeExtensions', valueOf: (s) => s.extensions, run: vscodeExtensions },
  { id: 'gitConfig', valueOf: (s) => s.git, run: gitConfig },
  { id: 'autostart', valueOf: (s) => s.autostart, run: autostart },
  { id: 'steamGames', valueOf: (s) => s.games, run: steamGames },
  { id: 'tibiaPages', valueOf: (s) => s.tibia, run: tibiaPages },
  { id: 'riotProducts', valueOf: (s) => s.riot, run: riotProducts },
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
