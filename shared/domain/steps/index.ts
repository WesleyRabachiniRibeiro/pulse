import { z } from 'zod'
import { vscodeExtensions } from './vscodeExtensions'
import { editorTweaks } from './editorTweaks'
import { runtimePackages } from './runtimePackages'
import { gitConfig } from './gitConfig'
import { steamGames } from './steamGames'
import { tibiaPages } from './tibiaPages'
import { riotProducts } from './riotProducts'
import { vsWorkloads } from './vsWorkloads'
import { browserDefault } from './browserDefault'
import { anyStep, isEmptyValue, summaryOf, type AnyStep } from './step'

export type { AnyStep, StepDescriptor } from './step'
export { byId, categoriesOf, countLabel, type SettingsOption } from './option'
export { TIBIA_BY_ID, TIBIA_CLIENTS } from './tibiaPages'
export { RIOT_BY_ID, RIOT_GAMES } from './riotProducts'
export { VSCODE_EXTENSIONS } from './vscodeExtensions'
export { VS_WORKLOADS } from './vsWorkloads'
export { browserChoiceSchema, type BrowserChoice } from './browserDefault'

export type StepId = keyof typeof stepsSchema.shape

export const STEPS: readonly AnyStep[] = [
  anyStep(vscodeExtensions),
  anyStep(editorTweaks),
  anyStep(runtimePackages),
  anyStep(gitConfig),
  anyStep(steamGames),
  anyStep(tibiaPages),
  anyStep(riotProducts),
  anyStep(vsWorkloads),
  anyStep(browserDefault),
]

export const STEP_BY_ID: ReadonlyMap<string, AnyStep> = new Map(
  STEPS.map((step) => [step.id, step]),
)

export const stepsSchema = z.object({
  vscodeExtensions: vscodeExtensions.schema.optional(),
  editorTweaks: editorTweaks.schema.optional(),
  runtimePackages: runtimePackages.schema.optional(),
  gitConfig: gitConfig.schema.optional(),
  steamGames: steamGames.schema.optional(),
  tibiaPages: tibiaPages.schema.optional(),
  riotProducts: riotProducts.schema.optional(),
  vsWorkloads: vsWorkloads.schema.optional(),
  browserDefault: browserDefault.schema.optional(),
})
export type Steps = z.infer<typeof stepsSchema>

export const STEPS_BY_KIND: Readonly<Record<string, readonly StepId[]>> = {
  vscode: ['vscodeExtensions', 'editorTweaks'],
  runtime: ['runtimePackages'],
  steam: ['steamGames'],
  git: ['gitConfig'],
  tibia: ['tibiaPages'],
  riot: ['riotProducts'],
  vs: ['vsWorkloads'],
  browser: ['browserDefault'],
}

interface StepCarrier {
  id: string
  steps?: readonly string[]
  settingsKind?: string
}

function declaredIds(program: StepCarrier): readonly string[] {
  if (program.steps) return program.steps
  if (program.settingsKind) return STEPS_BY_KIND[program.settingsKind] ?? []
  return []
}

export function stepsFor(program: StepCarrier): AnyStep[] {
  const found: AnyStep[] = []

  for (const id of declaredIds(program)) {
    const step = STEP_BY_ID.get(id)
    if (!step) continue
    if (step.optionsFor && step.optionsFor(program.id).length === 0) continue
    found.push(step)
  }

  return found
}

export function stepIdsFor(program: StepCarrier): string[] {
  return stepsFor(program).map((step) => step.id)
}

function valuesOf(steps: Steps | undefined): [AnyStep, unknown][] {
  if (!steps) return []

  const bag = steps as Record<string, unknown>
  const found: [AnyStep, unknown][] = []

  for (const step of STEPS) {
    const value = bag[step.id]
    if (value === undefined) continue
    if (isEmptyValue(step, value)) continue
    found.push([step, value])
  }

  return found
}

export function stepsAreEmpty(steps: Steps | undefined): boolean {
  return valuesOf(steps).length === 0
}

export function stepsSummary(steps: Steps | undefined): string[] {
  return valuesOf(steps).flatMap(([step, value]) => summaryOf(step, value))
}
