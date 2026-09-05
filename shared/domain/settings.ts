import { z } from 'zod'
import { steamGameSchema } from './steam'

export type SettingsKind = 'vscode' | 'steam' | 'git' | 'tibia' | 'riot' | 'vs' | 'browser'

export interface SettingsOption {
  id: string
  name: string
  hint: string
  category: string
  url?: string
}

export const VSCODE_EXTENSIONS: readonly SettingsOption[] = [
  {
    id: 'dracula-theme.theme-dracula',
    name: 'Dracula Official',
    hint: 'tema escuro',
    category: 'Temas',
  },
  {
    id: 'PKief.material-icon-theme',
    name: 'Material Icon Theme',
    hint: 'ícones nos arquivos',
    category: 'Temas',
  },
  {
    id: 'esbenp.prettier-vscode',
    name: 'Prettier',
    hint: 'formata o código sozinho',
    category: 'Ferramentas',
  },
  {
    id: 'dbaeumer.vscode-eslint',
    name: 'ESLint',
    hint: 'aponta erros enquanto você escreve',
    category: 'Ferramentas',
  },
  {
    id: 'eamodio.gitlens',
    name: 'GitLens',
    hint: 'mostra quem mudou cada linha',
    category: 'Ferramentas',
  },
  {
    id: 'ritwickdey.LiveServer',
    name: 'Live Server',
    hint: 'abre seu site no navegador na hora',
    category: 'Ferramentas',
  },
  {
    id: 'MS-CEINTL.vscode-language-pack-pt-BR',
    name: 'Pacote de idioma pt-BR',
    hint: 'menus em português',
    category: 'Idioma',
  },
]

export const TIBIA_CLIENTS: readonly SettingsOption[] = [
  {
    id: 'tibia-oficial',
    name: 'Tibia (oficial)',
    hint: 'da CipSoft, pede aceitar o contrato antes de baixar',
    category: 'Oficial',
    url: 'https://www.tibia.com/support/?subtopic=downloads',
  },
  {
    id: 'rubinot',
    name: 'RubinOT',
    hint: 'servidor brasileiro, evolução rápida e conteúdo próprio',
    category: 'Brasileiros',
    url: 'https://rubinot.com.br/download',
  },
  {
    id: 'pokexgames',
    name: 'PokeXGames',
    hint: 'Pokémon no motor do Tibia, comunidade brasileira',
    category: 'Brasileiros',
    url: 'https://www.pokexgames.com/',
  },
  {
    id: 'tibiantis',
    name: 'Tibiantis',
    hint: 'versão 7.7, regras antigas e evolução lenta',
    category: 'Old school',
    url: 'https://tibiantis.online/?page=download',
  },
  {
    id: 'medivia',
    name: 'Medivia Online',
    hint: 'nasceu de um servidor privado e virou jogo próprio',
    category: 'Old school',
    url: 'https://www.medivia.online/',
  },
]

export const TIBIA_BY_ID: ReadonlyMap<string, SettingsOption> = new Map(
  TIBIA_CLIENTS.map((client) => [client.id, client]),
)

export const RIOT_GAMES: readonly SettingsOption[] = [
  {
    id: 'RiotGames.Valorant.BR',
    name: 'VALORANT',
    hint: 'servidor Brasil',
    category: 'Jogos',
  },
  {
    id: 'RiotGames.LegendsOfRuneterra.Americas',
    name: 'Legends of Runeterra',
    hint: 'servidor Américas',
    category: 'Jogos',
  },
]

export const RIOT_BY_ID: ReadonlyMap<string, SettingsOption> = new Map(
  RIOT_GAMES.map((game) => [game.id, game]),
)

export const VS_WORKLOADS: readonly SettingsOption[] = [
  {
    id: 'Microsoft.VisualStudio.Workload.NativeDesktop',
    name: 'C e C++',
    hint: 'compilador, depurador e projetos de desktop',
    category: 'Linguagens',
  },
  {
    id: 'Microsoft.VisualStudio.Workload.ManagedDesktop',
    name: 'C#',
    hint: '.NET para desktop, WPF e Windows Forms',
    category: 'Linguagens',
  },
]

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
