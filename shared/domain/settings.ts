import { z } from 'zod'
import { installScopeSchema, LOCALE_BY_ID, scopeLabel } from './winget'
import {
  stepsAreEmpty,
  stepsSchema,
  stepsSummary,
  STEPS_BY_KIND,
  type Steps,
} from './steps'

export const settingsKindSchema = z.enum([
  'vscode',
  'runtime',
  'steam',
  'git',
  'tibia',
  'riot',
  'vs',
  'browser',
])
export type SettingsKind = z.infer<typeof settingsKindSchema>

export {
  byId,
  categoriesOf,
  RIOT_BY_ID,
  RIOT_GAMES,
  stepsFor,
  stepIdsFor,
  STEPS,
  TIBIA_BY_ID,
  TIBIA_CLIENTS,
  VS_WORKLOADS,
  VSCODE_EXTENSIONS,
  type SettingsOption,
  type StepDescriptor,
  type StepId,
  type Steps,
} from './steps'

export { DEFAULT_GIT, gitSchema, type GitConfig } from './git'

const LIFTED: Readonly<Record<string, string>> = {
  extensions: 'vscodeExtensions',
  editorTweaks: 'editorTweaks',
  globalPackages: 'runtimePackages',
  git: 'gitConfig',
  games: 'steamGames',
  tibia: 'tibiaPages',
  riot: 'riotProducts',
  workloads: 'vsWorkloads',
}

export function upgradeSettings(raw: unknown): unknown {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return raw

  const old = raw as Record<string, unknown>
  const flat: Record<string, unknown> = {}
  const steps: Record<string, unknown> = { ...((old['steps'] as object) ?? {}) }

  for (const [key, value] of Object.entries(old)) {
    if (key === 'steps') continue

    const lifted = LIFTED[key]
    if (lifted !== undefined) {
      if (value !== undefined && steps[lifted] === undefined) steps[lifted] = value
      continue
    }

    if (key === 'makeDefault' || key === 'openAfter') {
      if (value === undefined) continue
      const browser = (steps['browserDefault'] as Record<string, unknown>) ?? {}
      if (browser[key] === undefined) steps['browserDefault'] = { ...browser, [key]: value }
      continue
    }

    flat[key] = value
  }

  if (Object.keys(steps).length > 0) flat['steps'] = steps
  return flat
}

const nestedSettingsSchema = z.object({
  packageId: z.string().optional(),
  scope: installScopeSchema.optional(),
  locale: z.string().optional(),
  interactive: z.boolean().optional(),
  desktopShortcut: z.boolean().optional(),
  autostart: z.boolean().optional(),
  steps: stepsSchema.optional(),
})

export const settingsSchema = z.preprocess(upgradeSettings, nestedSettingsSchema)
export type Settings = z.infer<typeof nestedSettingsSchema>

export function optionsFor(kind: SettingsKind): readonly string[] {
  return STEPS_BY_KIND[kind] ?? []
}

const TRISTATE_FIELDS: readonly string[] = ['autostart', 'desktopShortcut']

function fieldMatters(key: string, value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.length > 0
  if (typeof value === 'string') return value.trim().length > 0
  if (typeof value === 'boolean') return value || TRISTATE_FIELDS.includes(key)
  if (typeof value === 'object') {
    return Object.entries(value).some(([inner, nested]) => fieldMatters(inner, nested))
  }
  return true
}

export function settingsAreEmpty(settings: Settings | undefined): boolean {
  if (!settings) return true

  const { steps, ...flat } = settings
  const flatMatters = Object.entries(flat).some(([key, value]) => fieldMatters(key, value))

  return !flatMatters && stepsAreEmpty(steps)
}

export function settingsKey(settings: Settings | undefined): string {
  return canonical(settings ?? {})
}

function canonical(value: unknown): string {
  if (value === undefined || value === null) return 'null'
  if (Array.isArray(value)) return `[${value.map(canonical).sort().join(',')}]`
  if (typeof value === 'object') {
    const fields = Object.entries(value)
      .filter(([, nested]) => nested !== undefined)
      .map(([key, nested]) => `${key}:${canonical(nested)}`)
      .sort()
    return `{${fields.join(',')}}`
  }
  return JSON.stringify(value)
}

export function settingsSummary(settings: Settings | undefined): string | null {
  if (!settings) return null

  const parts: string[] = []

  if (settings.scope) parts.push(scopeLabel(settings.scope))
  if (settings.locale) parts.push(LOCALE_BY_ID.get(settings.locale)?.name ?? settings.locale)
  if (settings.interactive) parts.push('instalador na tela')
  if (settings.desktopShortcut === true) parts.push('atalho na área de trabalho')
  if (settings.desktopShortcut === false) parts.push('sem atalho na área de trabalho')

  parts.push(...stepsSummary(settings.steps))

  if (settings.autostart === true) parts.push('abre com o Windows')
  if (settings.autostart === false) parts.push('não abre sozinho')

  return parts.length ? parts.join(' · ') : null
}

export type { Steps as SettingsSteps }
