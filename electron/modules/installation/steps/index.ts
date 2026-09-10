import type { Settings } from '@shared/domain/settings'
import { autostart } from './autostart'
import { desktopShortcut } from './desktopShortcut'
import { editorTweaks } from './editorTweaks'
import { gitConfig } from './gitConfig'
import { riotProducts } from './riotProducts'
import { runtimePackages } from './runtimePackages'
import { steamGames } from './steamGames'
import { tibiaPages } from './tibiaPages'
import { vscodeExtensions } from './vscodeExtensions'
import type { StepContext, StepResult, StepRunner } from './context'

interface StepEntry {
  id: string
  valueOf: (settings: Settings) => unknown
  run: StepRunner
}

const ORDER: readonly StepEntry[] = [
  { id: 'vscodeExtensions', valueOf: (s) => s.steps?.vscodeExtensions, run: vscodeExtensions },
  { id: 'runtimePackages', valueOf: (s) => s.steps?.runtimePackages, run: runtimePackages },
  { id: 'editorTweaks', valueOf: (s) => s.steps?.editorTweaks, run: editorTweaks },
  { id: 'gitConfig', valueOf: (s) => s.steps?.gitConfig, run: gitConfig },
  { id: 'desktopShortcut', valueOf: (s) => s.desktopShortcut, run: desktopShortcut },
  { id: 'autostart', valueOf: (s) => s.autostart, run: autostart },
  { id: 'steamGames', valueOf: (s) => s.steps?.steamGames, run: steamGames },
  { id: 'tibiaPages', valueOf: (s) => s.steps?.tibiaPages, run: tibiaPages },
  { id: 'riotProducts', valueOf: (s) => s.steps?.riotProducts, run: riotProducts },
]

export const STEP_IDS: readonly string[] = ORDER.map((entry) => entry.id)

export async function runSteps(ctx: StepContext): Promise<StepResult> {
  const found: StepResult = {}

  for (const entry of ORDER) {
    const value = entry.valueOf(ctx.settings)
    if (value === undefined) continue
    Object.assign(found, await entry.run(value as never, ctx))
  }

  return found
}

export { setAutostart, type AutostartResult } from './autostart'
export type { StepContext, StepOutput, StepResult, StepRunner } from './context'
