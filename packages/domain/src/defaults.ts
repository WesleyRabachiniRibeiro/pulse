import { z } from 'zod'

export const scopeSchema = z.enum(['user', 'machine'])
export type Scope = z.infer<typeof scopeSchema>

export const defaultsSchema = z.object({
  scope: scopeSchema.optional(),
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

export interface Locale {
  id: string
  name: string
}

export const LOCALES: readonly Locale[] = [
  { id: 'pt-BR', name: 'Português' },
  { id: 'en-US', name: 'Inglês' },
  { id: 'es-ES', name: 'Espanhol' },
]

const KEPT: Record<DefaultKey, string> = {
  scope: 'do jeito do programa',
  locale: 'do jeito que vier',
  interactive: 'em silêncio',
  desktopShortcut: 'como o instalador deixou',
  autostart: 'como está',
}

const CHOSEN: Record<DefaultKey, (value: NonNullable<Defaults[DefaultKey]>) => string> = {
  scope: (value) => (value === 'machine' ? 'para todos' : 'só para mim'),
  locale: (value) => LOCALES.find((one) => one.id === value)?.name ?? String(value),
  interactive: (value) => (value === true ? 'mostrar' : 'em silêncio'),
  desktopShortcut: (value) => (value === true ? 'criar' : 'não criar'),
  autostart: (value) => (value === true ? 'abrir' : 'não abrir'),
}

export function defaultLabel(key: DefaultKey, defaults: Defaults): string {
  const value = defaults[key]
  return value === undefined ? KEPT[key] : CHOSEN[key](value)
}
