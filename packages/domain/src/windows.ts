import { z } from 'zod'

export interface TweakValue {
  key: string
  name: string
  on: number
  off: number
}

export interface Tweak {
  id: string
  name: string
  hint: string
  values: readonly TweakValue[]
  refreshesExplorer: boolean
}

const EXPLORER = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Advanced'
const THEMES = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Themes\\Personalize'
const CONTENT = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'

// Tudo em HKCU: vale para a pessoa que está usando e não pede administrador.
export const TWEAKS: readonly Tweak[] = [
  {
    id: 'fileExtensions',
    name: 'Mostrar a extensão dos arquivos',
    hint: 'ver .exe e .pdf no fim do nome ajuda a não abrir o arquivo errado',
    values: [{ key: EXPLORER, name: 'HideFileExt', on: 0, off: 1 }],
    refreshesExplorer: true,
  },
  {
    id: 'darkMode',
    name: 'Modo escuro do Windows',
    hint: 'vale para o menu Iniciar, o Explorador e os programas que seguem o sistema',
    values: [
      { key: THEMES, name: 'AppsUseLightTheme', on: 0, off: 1 },
      { key: THEMES, name: 'SystemUsesLightTheme', on: 0, off: 1 },
    ],
    refreshesExplorer: false,
  },
  {
    id: 'noSuggestions',
    name: 'Não sugerir aplicativos no menu Iniciar',
    hint: 'tira as propagandas e os programas que aparecem sozinhos',
    values: [
      { key: CONTENT, name: 'SystemPaneSuggestionsEnabled', on: 0, off: 1 },
      { key: CONTENT, name: 'SilentInstalledAppsEnabled', on: 0, off: 1 },
    ],
    refreshesExplorer: false,
  },
  {
    id: 'explorerThisPc',
    name: 'Abrir o Explorador em Este Computador',
    hint: 'em vez do Acesso rápido, que mostra o que você abriu por último',
    values: [{ key: EXPLORER, name: 'LaunchTo', on: 1, off: 2 }],
    refreshesExplorer: true,
  },
]

export const TWEAK_BY_ID: ReadonlyMap<string, Tweak> = new Map(TWEAKS.map((t) => [t.id, t]))

export const tweakStateSchema = z.object({
  id: z.string(),
  on: z.boolean(),
})
export type TweakState = z.infer<typeof tweakStateSchema>

export const tweakInputSchema = z.object({
  id: z.string(),
  on: z.boolean(),
})
export type TweakInput = z.infer<typeof tweakInputSchema>

export function valueIdOf(value: TweakValue): string {
  return `${value.key}\\${value.name}`
}

// Um ajuste com mais de um valor só conta como ligado com todos ligados: meio
// ligado é o Windows em estado inconsistente, e a tela deve mostrar desligado.
export function readTweakState(tweak: Tweak, found: ReadonlyMap<string, number>): boolean {
  return tweak.values.every((value) => found.get(valueIdOf(value)) === value.on)
}

export function tweaksTouchingExplorer(ids: readonly string[]): boolean {
  return ids.some((id) => TWEAK_BY_ID.get(id)?.refreshesExplorer === true)
}
