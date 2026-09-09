import { z } from 'zod'
import { installScopeSchema, LOCALE_BY_ID, scopeLabel } from './winget'
import type { Settings } from './settings'

export const defaultsSchema = z.object({
  scope: installScopeSchema.optional(),
  locale: z.string().optional(),
  interactive: z.boolean().optional(),
  desktopShortcut: z.boolean().optional(),
  autostart: z.boolean().optional(),
})
export type Defaults = z.infer<typeof defaultsSchema>

export const EMPTY_DEFAULTS: Defaults = {}

export const DEFAULT_KEYS = [
  'scope',
  'locale',
  'interactive',
  'desktopShortcut',
  'autostart',
] as const

export type DefaultKey = (typeof DEFAULT_KEYS)[number]

export function applyDefaults(settings: Settings | undefined, defaults: Defaults): Settings {
  const merged: Settings = { ...settings }

  for (const key of DEFAULT_KEYS) {
    if (merged[key] === undefined && defaults[key] !== undefined) {
      Object.assign(merged, { [key]: defaults[key] })
    }
  }

  return merged
}

export function overriddenKeys(
  settings: Settings | undefined,
  defaults: Defaults,
): DefaultKey[] {
  if (!settings) return []

  return DEFAULT_KEYS.filter((key) => {
    const chosen = settings[key]
    return chosen !== undefined && chosen !== defaults[key]
  })
}

export function countOverrides(
  settingsById: Readonly<Record<string, Settings>>,
  defaults: Defaults,
): number {
  return Object.values(settingsById).filter(
    (settings) => overriddenKeys(settings, defaults).length > 0,
  ).length
}

export function programsOverriding(
  settingsById: Readonly<Record<string, Settings>>,
  defaults: Defaults,
  key: DefaultKey,
): string[] {
  return Object.entries(settingsById)
    .filter(([, settings]) => overriddenKeys(settings, defaults).includes(key))
    .map(([id]) => id)
    .sort()
}

export function defaultLabel(key: DefaultKey, defaults: Defaults): string {
  const value = defaults[key]

  if (key === 'scope') return value ? scopeLabel(value as never) : 'do jeito do programa'
  if (key === 'locale') {
    return typeof value === 'string'
      ? (LOCALE_BY_ID.get(value)?.name ?? value)
      : 'do jeito que vier'
  }
  if (key === 'interactive') return value === true ? 'mostrar a janela' : 'em silêncio'
  if (key === 'desktopShortcut') {
    if (value === true) return 'criar o atalho'
    if (value === false) return 'não criar o atalho'
    return 'deixar como o instalador deixou'
  }
  if (value === true) return 'abrir com o Windows'
  if (value === false) return 'não abrir sozinho'
  return 'deixar como está'
}
