import { z } from 'zod'
import type { SettingsKind } from '@pulse/catalog-data'
import { vscodeExtensions } from './vscodeExtensions'
import { editorTweaks } from './editorTweaks'
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
  anyStep(editorTweaks),
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
  editorTweaks: editorTweaks.schema.optional(),
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
  vscode: ['vscodeExtensions', 'editorTweaks'],
  steam: ['steamGames'],
  tibia: ['tibiaPages'],
  riot: ['riotProducts'],
  vs: ['vsWorkloads'],
  git: ['gitConfig'],
  browser: ['browserDefault'],
}

// A tela pergunta qual step atende um tipo em vez de saber que 'tibia' guarda
// em tibiaPages. Título, descrição e texto de busca vêm junto, do descritor.
export function stepForKind(kind: SettingsKind | undefined): AnyStep | undefined {
  if (!kind) return undefined
  const [first] = STEPS_BY_KIND[kind] ?? []
  return first ? STEP_BY_ID.get(first) : undefined
}

// Só alguns tipos mostram uma lista para marcar. Git, Steam e navegador têm
// step, mas a tela desenha outra coisa para eles.
export function listStepFor(kind: SettingsKind | undefined): AnyStep | undefined {
  const step = stepForKind(kind)
  return step?.options ? step : undefined
}

export function listValue(steps: Steps | undefined, step: AnyStep | undefined): readonly string[] {
  if (!step) return []
  const value = (steps as Record<string, unknown> | undefined)?.[step.id]
  return Array.isArray(value) ? (value as string[]) : []
}

export function withListValue(steps: Steps | undefined, step: AnyStep, value: readonly string[]): Steps {
  return { ...steps, [step.id]: [...value] } as Steps
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
