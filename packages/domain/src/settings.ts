import { z } from 'zod'
import {
  VSCODE_EXTENSIONS,
  TIBIA_CLIENTS,
  RIOT_GAMES,
  VS_WORKLOADS,
  type SettingsKind,
  type SettingsOption,
} from '@pulse/catalog-data'
import { steamGameSchema } from './steam'

export type { SettingsOption } from '@pulse/catalog-data'

export const gitSchema = z.object({
  name: z.string(),
  email: z.string(),
  branch: z.string(),
  saveLogin: z.boolean().optional(),
})
export type GitConfig = z.infer<typeof gitSchema>

export const settingsSchema = z.object({
  packageId: z.string().optional(),
  autostart: z.boolean().optional(),
  extensions: z.array(z.string()).optional(),
  games: z.array(steamGameSchema).optional(),
  git: gitSchema.optional(),
  tibia: z.array(z.string()).optional(),
  riot: z.array(z.string()).optional(),
  workloads: z.array(z.string()).optional(),
  makeDefault: z.boolean().optional(),
  openAfter: z.boolean().optional(),
})
export type Settings = z.infer<typeof settingsSchema>

export const DEFAULT_GIT: GitConfig = { name: '', email: '', branch: 'main' }

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

export function settingsAreEmpty(settings: Settings | undefined): boolean {
  if (!settings) return true
  const noBrowser = !settings.makeDefault && !settings.openAfter
  const noLists =
    !settings.extensions?.length &&
    !settings.games?.length &&
    !settings.tibia?.length &&
    !settings.riot?.length &&
    !settings.workloads?.length
  const noGit =
    !settings.git || (!settings.git.name && !settings.git.email && !settings.git.saveLogin)
  const noAutostart = settings.autostart === undefined
  return noLists && noGit && noAutostart && noBrowser && !settings.packageId
}

export function settingsSummary(settings: Settings | undefined): string | null {
  if (!settings) return null

  const parts: string[] = []
  const extensions = settings.extensions?.length ?? 0
  const games = settings.games ?? []

  if (extensions) parts.push(`${extensions} ${extensions === 1 ? 'extensão' : 'extensões'}`)
  if (games.length > 0 && games.length <= 2) parts.push(games.map((g) => g.name).join(' e '))
  else if (games.length > 2) parts.push(`${games.length} jogos`)
  const tibia = settings.tibia?.length ?? 0
  if (tibia) parts.push(`${tibia} ${tibia === 1 ? 'cliente' : 'clientes'}`)
  const riot = settings.riot?.length ?? 0
  if (riot) parts.push(`${riot} ${riot === 1 ? 'jogo da Riot' : 'jogos da Riot'}`)
  const workloads = settings.workloads?.length ?? 0
  if (workloads) parts.push(`${workloads} ${workloads === 1 ? 'linguagem' : 'linguagens'}`)
  if (settings.git?.name || settings.git?.email) parts.push('Git configurado')
  if (settings.git?.saveLogin) parts.push('login do GitHub guardado')
  if (settings.makeDefault) parts.push('navegador padrão')
  if (settings.openAfter) parts.push('abre no fim')
  if (settings.autostart === true) parts.push('abre com o Windows')
  if (settings.autostart === false) parts.push('não abre sozinho')

  return parts.length ? parts.join(' · ') : null
}
