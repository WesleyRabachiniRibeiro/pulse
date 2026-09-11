import { z } from 'zod'
import type { SettingsKind } from '@pulse/catalog-data'
import { vscodeExtensions } from './vscodeExtensions'
import { steamGames } from './steamGames'
import { tibiaPages } from './tibiaPages'
import { riotProducts } from './riotProducts'
import { vsWorkloads } from './vsWorkloads'
import { gitConfig } from './gitConfig'
import { browserDefault } from './browserDefault'
import { anyStep, isEmptyValue, summaryOf, type AnyStep } from './step'

export type { AnyStep, StepDescriptor } from './step'
export { countLabel } from './label'
export { browserChoiceSchema, type BrowserChoice } from './browserDefault'

// A ordem é a que a tela mostra e a que o resumo lê, nesta sequência.
export const STEPS: readonly AnyStep[] = [
  anyStep(vscodeExtensions),
  anyStep(steamGames),
  anyStep(tibiaPages),
  anyStep(riotProducts),
  anyStep(vsWorkloads),
  anyStep(gitConfig),
  anyStep(browserDefault),
]

export const STEP_BY_ID: ReadonlyMap<string, AnyStep> = new Map(STEPS.map((s) => [s.id, s]))

export const stepsSchema = z.object({
  vscodeExtensions: vscodeExtensions.schema.optional(),
  steamGames: steamGames.schema.optional(),
  tibiaPages: tibiaPages.schema.optional(),
  riotProducts: riotProducts.schema.optional(),
  vsWorkloads: vsWorkloads.schema.optional(),
  gitConfig: gitConfig.schema.optional(),
  browserDefault: browserDefault.schema.optional(),
})
export type Steps = z.infer<typeof stepsSchema>
export type StepId = keyof Steps

export const STEPS_BY_KIND: Readonly<Record<SettingsKind, readonly StepId[]>> = {
  vscode: ['vscodeExtensions'],
  steam: ['steamGames'],
  tibia: ['tibiaPages'],
  riot: ['riotProducts'],
  vs: ['vsWorkloads'],
  git: ['gitConfig'],
  browser: ['browserDefault'],
}

interface StepCarrier {
  id: string
  steps?: readonly string[]
  settingsKind?: SettingsKind
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
