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
import { DEFAULT_KEYS, scopeSchema, type DefaultKey, type Defaults } from './defaults'

export type { SettingsOption } from '@pulse/catalog-data'

export const settingsSchema = z.object({
  packageId: z.string().optional(),
  scope: scopeSchema.optional(),
  locale: z.string().optional(),
  interactive: z.boolean().optional(),
  desktopShortcut: z.boolean().optional(),
  autostart: z.boolean().optional(),
  steps: stepsSchema.optional(),
})
export type Settings = z.infer<typeof settingsSchema>

// O padrão é o chão: o programa só sai dele no que ele mesmo pediu. Um campo
// que o programa não tocou fica valendo o que a configuração disser.
export function withDefaults(settings: Settings | undefined, defaults: Defaults): Settings {
  const merged: Settings = { ...settings }

  for (const key of DEFAULT_KEYS) {
    if (merged[key] !== undefined) continue
    const value = defaults[key]
    if (value !== undefined) Object.assign(merged, { [key]: value })
  }

  return merged
}

// Em que um programa foge do padrão. A configuração pergunta por campo, a
// seleção pergunta por programa, e as duas leem a mesma comparação.
export function overriddenKeys(
  settings: Settings | undefined,
  defaults: Defaults,
): DefaultKey[] {
  if (!settings) return []
  return DEFAULT_KEYS.filter(
    (key) => settings[key] !== undefined && settings[key] !== defaults[key],
  )
}

// Quem foge do padrão, para a tela de configuração poder dizer quantos são.
export function programsOverriding(
  settingsByApp: Readonly<Record<string, Settings>>,
  defaults: Defaults,
  key: DefaultKey,
): string[] {
  return Object.entries(settingsByApp)
    .filter(([, settings]) => overriddenKeys(settings, defaults).includes(key))
    .map(([id]) => id)
}

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
