import { z } from 'zod'
import {
  VSCODE_EXTENSIONS,
  TIBIA_CLIENTS,
  RIOT_GAMES,
  VS_WORKLOADS,
  type SettingsKind,
  type SettingsOption,
} from '@pulse/catalog-data'
import { stepsAreEmpty, stepsSchema, stepsSummary } from './steps'

export type { SettingsOption } from '@pulse/catalog-data'

export const settingsSchema = z.object({
  packageId: z.string().optional(),
  autostart: z.boolean().optional(),
  steps: stepsSchema.optional(),
})
export type Settings = z.infer<typeof settingsSchema>

export function optionsFor(kind: SettingsKind): readonly SettingsOption[] {
  if (kind === 'vscode') return VSCODE_EXTENSIONS
  if (kind === 'tibia') return TIBIA_CLIENTS
  if (kind === 'riot') return RIOT_GAMES
  if (kind === 'vs') return VS_WORKLOADS
  return []
}

export function categoriesOf(options: readonly SettingsOption[]): string[] {
  const seen: string[] = []
  for (const option of options) if (!seen.includes(option.category)) seen.push(option.category)
  return ['Tudo', ...seen]
}

// Ligar e desligar a inicialização são as duas um pedido, então o que conta
// como "sem ajuste" é o campo não ter sido tocado, não o valor ser falso.
export function settingsAreEmpty(settings: Settings | undefined): boolean {
  if (!settings) return true
  return stepsAreEmpty(settings.steps) && settings.autostart === undefined && !settings.packageId
}

export function settingsSummary(settings: Settings | undefined): string | null {
  if (!settings) return null

  const parts = [...stepsSummary(settings.steps)]
  if (settings.autostart === true) parts.push('abre com o Windows')
  if (settings.autostart === false) parts.push('não abre sozinho')

  return parts.length ? parts.join(' · ') : null
}
