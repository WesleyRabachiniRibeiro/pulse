import { z } from 'zod'

export const scopeSchema = z.enum(['user', 'machine'])
export type Scope = z.infer<typeof scopeSchema>

// O que vale para todo programa da fila, até que o programa peça diferente.
// Campo ausente quer dizer "do jeito que o instalador faz", e não um valor
// falso: é a ausência que a tela mostra como "manter".
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

// O winget recebe a etiqueta BCP 47 em --locale, e só instala nela quem tem o
// pacote naquele idioma. Quem não tem vem no idioma que vier.
export const LOCALES: readonly Locale[] = [
  { id: 'pt-BR', name: 'Português' },
  { id: 'en-US', name: 'Inglês' },
  { id: 'es-ES', name: 'Espanhol' },
]

// Como o padrão de cada campo se lê na tela do programa, para a linha dizer
// "PADRÃO: EM SILÊNCIO" em vez de repetir o valor cru.
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
