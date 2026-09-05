import { z } from 'zod'
import type { SettingsKind } from './settings'

export type CategoryId = 'browsers' | 'games' | 'media' | 'dev'

export interface Category {
  id: CategoryId
  name: string
}

export interface Program {
  id: string
  name: string
  winget?: string
  source?: 'msstore' | 'pages'
  version: string
  mb: number
  category: CategoryId
  hints: readonly string[]
  notice?: string
  settingsKind?: SettingsKind
  family?: {
    prefix: string
    pattern: string
  }
}

export const CATEGORIES: readonly Category[] = [
  { id: 'browsers', name: 'NAVEGADORES' },
  { id: 'games', name: 'GAMES' },
  { id: 'media', name: 'COMUNICAÇÃO E MÍDIA' },
  { id: 'dev', name: 'DESENVOLVIMENTO' },
]

export const CATALOG: readonly Program[] = [
  { id: 'chrome', name: 'Google Chrome', winget: 'Google.Chrome', version: '152.0.7977', mb: 118, category: 'browsers', hints: ['google chrome'], settingsKind: 'browser' },
  { id: 'firefox', name: 'Mozilla Firefox', winget: 'Mozilla.Firefox', version: '155.0.1', mb: 62, category: 'browsers', hints: ['mozilla firefox'], settingsKind: 'browser' },
  { id: 'brave', name: 'Brave', winget: 'Brave.Brave', version: '152.1.94', mb: 145, category: 'browsers', hints: ['brave'], settingsKind: 'browser' },
  { id: 'operagx', name: 'Opera GX', winget: 'Opera.OperaGX', version: '135.0.5973', mb: 98, category: 'browsers', hints: ['opera gx'], settingsKind: 'browser' },

  { id: 'steam', name: 'Steam', winget: 'Valve.Steam', version: '2.10.91', mb: 320, category: 'games', hints: ['steam'], settingsKind: 'steam' },
  { id: 'epic', name: 'Epic Games', winget: 'EpicGames.EpicGamesLauncher', version: '1.3.193', mb: 210, category: 'games', hints: ['epic games launcher'] },
  { id: 'minecraft', name: 'Minecraft Launcher', winget: 'Mojang.MinecraftLauncher', version: '2.0.0', mb: 45, category: 'games', hints: ['minecraft launcher'] },
  { id: 'riot', name: 'Riot Client', winget: 'RiotGames.LeagueOfLegends.BR', version: '138.0.0', mb: 76, category: 'games', hints: ['riot client', 'league of legends'], settingsKind: 'riot' },
  { id: 'curseforge', name: 'CurseForge', winget: 'Overwolf.CurseForge', version: '0.220.1', mb: 120, category: 'games', hints: ['curseforge'] },
  { id: 'battlenet', name: 'Battle.net', winget: 'Blizzard.BattleNet', version: '1.19.3', mb: 90, category: 'games', hints: ['battle.net'] },
  { id: 'roblox', name: 'Roblox', winget: 'Roblox.Roblox', version: '0.726', mb: 120, category: 'games', hints: ['roblox player'] },
  {
    id: 'hydra',
    name: 'Hydra',
    winget: 'HydraLauncher.Hydra',
    version: '4.1.3',
    mb: 120,
    category: 'games',
    hints: ['hydra'],
    notice:
      'O Pulse só instala o Hydra pelo winget, a partir do pacote publicado pelo autor. Ele não vem com nenhuma fonte configurada, e o Pulse não responde pelo programa nem pelo conteúdo que você acessar por ele.',
  },
  { id: 'gog', name: 'GOG Galaxy', winget: 'GOG.Galaxy', version: '2.1.8', mb: 260, category: 'games', hints: ['gog galaxy'] },
  { id: 'hytale', name: 'Hytale Launcher', winget: 'HypixelStudios.Hytale', version: '2026.08.28', mb: 90, category: 'games', hints: ['hytale'] },
  { id: 'eaapp', name: 'EA app', winget: 'ElectronicArts.EADesktop', version: '13.783', mb: 180, category: 'games', hints: ['ea app', 'ea desktop'] },
  { id: 'ubisoft', name: 'Ubisoft Connect', winget: 'Ubisoft.Connect', version: '173.1.0', mb: 130, category: 'games', hints: ['ubisoft connect'] },
  { id: 'tibia', name: 'Tibia', source: 'pages', version: 'vários clientes', mb: 0, category: 'games', hints: [], settingsKind: 'tibia' },
  { id: 'radminvpn', name: 'Radmin VPN', winget: 'Famatech.RadminVPN', version: '2.0.4899', mb: 15, category: 'games', hints: ['radmin vpn'] },

  { id: 'discord', name: 'Discord', winget: 'Discord.Discord', version: '1.0.9256', mb: 92, category: 'media', hints: ['discord'] },
  { id: 'spotify', name: 'Spotify', winget: 'Spotify.Spotify', version: '1.2.98', mb: 140, category: 'media', hints: ['spotify'] },
  { id: 'telegram', name: 'Telegram', winget: 'Telegram.TelegramDesktop', version: '7.2.5', mb: 55, category: 'media', hints: ['telegram desktop', 'telegram'] },
  {
    id: 'stremio',
    name: 'Stremio',
    winget: 'Stremio.Stremio',
    version: '4.4.181',
    mb: 90,
    category: 'media',
    hints: ['stremio'],
    notice:
      'O Pulse só instala o Stremio pelo winget, a partir do pacote publicado pelo autor. Nenhum complemento vem junto, e o Pulse não responde pelo programa nem pelo conteúdo que você acessar por ele.',
  },
  { id: 'obs', name: 'OBS Studio', winget: 'OBSProject.OBSStudio', version: '32.2.1', mb: 150, category: 'media', hints: ['obs studio'] },
  { id: 'linkedin', name: 'LinkedIn', winget: '9WZDNCRFJ4Q7', source: 'msstore', version: 'da Store', mb: 24, category: 'media', hints: ['linkedin'] },

  { id: 'vscode', name: 'VS Code', winget: 'Microsoft.VisualStudioCode', version: '1.136.1', mb: 108, category: 'dev', hints: ['microsoft visual studio code'], settingsKind: 'vscode' },
  { id: 'intellij', name: 'IntelliJ IDEA CE', winget: 'JetBrains.IntelliJIDEA.Community', version: '2025.2.6', mb: 890, category: 'dev', hints: ['intellij idea community edition'] },
  { id: 'gitbash', name: 'Git Bash', winget: 'Git.Git', version: '2.55.0', mb: 66, category: 'dev', hints: ['git'], settingsKind: 'git' },
  {
    id: 'jdk',
    name: 'Java (Temurin)',
    winget: 'EclipseAdoptium.Temurin.21.JDK',
    version: '21 LTS',
    mb: 180,
    category: 'dev',
    hints: ['eclipse temurin jdk'],
    family: { prefix: 'EclipseAdoptium.Temurin', pattern: '^EclipseAdoptium\\.Temurin\\.\\d+\\.JDK$' },
  },
  { id: 'claude', name: 'Claude', winget: 'Anthropic.Claude', version: '1.44121.2', mb: 130, category: 'dev', hints: ['claude'] },
  { id: 'claudecode', name: 'Claude Code', winget: 'Anthropic.ClaudeCode', version: '2.1.258', mb: 48, category: 'dev', hints: ['claude code'] },
  { id: 'docker', name: 'Docker Desktop', winget: 'Docker.DockerDesktop', version: '4.89.0', mb: 620, category: 'dev', hints: ['docker desktop'] },
  {
    id: 'node',
    name: 'Node.js',
    winget: 'OpenJS.NodeJS.LTS',
    version: '24 LTS',
    mb: 30,
    category: 'dev',
    hints: ['node.js'],
    family: { prefix: 'OpenJS.NodeJS', pattern: '^OpenJS\\.NodeJS(\\.LTS|\\.\\d+)?$' },
  },
  {
    id: 'python',
    name: 'Python 3',
    winget: 'Python.Python.3.13',
    version: '3.13',
    mb: 28,
    category: 'dev',
    hints: ['python 3'],
    family: { prefix: 'Python.Python', pattern: '^Python\\.Python\\.3\\.\\d+$' },
  },
  { id: 'vs', name: 'Visual Studio', winget: 'Microsoft.VisualStudio.Community', version: '2026', mb: 1800, category: 'dev', hints: ['visual studio community'], settingsKind: 'vs' },
  { id: 'vim', name: 'Vim', winget: 'vim.vim', version: '9.2', mb: 12, category: 'dev', hints: ['vim'] },
  { id: 'codex', name: 'Codex CLI', winget: 'OpenAI.Codex', version: '0.146.1', mb: 40, category: 'dev', hints: ['codex cli', 'codex'] },
  { id: 'go', name: 'Go', winget: 'GoLang.Go', version: '1.27.0', mb: 70, category: 'dev', hints: ['go programming language'] },
  { id: 'postman', name: 'Postman', winget: 'Postman.Postman', version: '12.26.5', mb: 210, category: 'dev', hints: ['postman'] },
  { id: 'insomnia', name: 'Insomnia', winget: 'Insomnia.Insomnia', version: '13.2.0', mb: 130, category: 'dev', hints: ['insomnia'] },
  { id: 'blender', name: 'Blender', winget: 'BlenderFoundation.Blender', version: '5.2.1', mb: 380, category: 'dev', hints: ['blender'] },
]

export const PROGRAM_BY_ID: ReadonlyMap<string, Program> = new Map(CATALOG.map((p) => [p.id, p]))

export const packageVersionSchema = z.object({
  winget: z.string(),
  name: z.string(),
  version: z.string(),
  recommended: z.boolean(),
})
export type PackageVersion = z.infer<typeof packageVersionSchema>

export interface Bundle {
  name: string
  ids: readonly string[]
}

export const BUNDLES: readonly Bundle[] = [
  { name: 'Essencial', ids: ['chrome', 'discord', 'spotify'] },
  {
    name: 'Setup gamer',
    ids: ['operagx', 'steam', 'epic', 'battlenet', 'minecraft', 'riot', 'curseforge', 'discord', 'spotify'],
  },
  {
    name: 'Trabalho e código',
    ids: ['chrome', 'vscode', 'gitbash', 'node', 'python', 'postman', 'claude', 'claudecode', 'docker', 'discord'],
  },
  { name: 'Tudo', ids: CATALOG.map((p) => p.id) },
]

export function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  }
  return `${mb.toLocaleString('pt-BR')} MB`
}

export function totalSizeMb(ids: Iterable<string>): number {
  let total = 0
  for (const id of ids) total += PROGRAM_BY_ID.get(id)?.mb ?? 0
  return total
}

export function estimatedMinutes(mb: number): number {
  return Math.max(2, Math.round(mb / 90))
}

function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function filterCatalog(term: string): readonly Program[] {
  const needle = normalize(term.trim())
  if (!needle) return CATALOG

  const categoryNames = new Map(CATEGORIES.map((c) => [c.id, normalize(c.name)]))
  return CATALOG.filter(
    (p) =>
      normalize(p.name).includes(needle) ||
      (categoryNames.get(p.category) ?? '').includes(needle),
  )
}

const SEPARATORS = [' ', '(', '-', '.', ',']

function hintMatches(name: string, hint: string): boolean {
  if (!name.startsWith(hint)) return false
  const next = name[hint.length]
  return next === undefined || SEPARATORS.includes(next)
}

export function nameMatchesProgram(installedName: string, program: Program): boolean {
  const name = normalize(installedName.trim())
  return program.hints.some((hint) => hintMatches(name, hint))
}

export function entryMatchesProgram(entryName: string, entryValue: string, program: Program): boolean {
  const target = `${entryName} ${entryValue}`.toLowerCase()
  const tight = target.replace(/[^a-z0-9]/g, '')

  return program.hints.some((raw) => {
    const hint = raw.toLowerCase()
    if (target.includes(hint)) return true
    if (!hint.trim().includes(' ')) return false
    return tight.includes(hint.replace(/[^a-z0-9]/g, ''))
  })
}

export function installedIds(installedNames: readonly string[]): string[] {
  const found = new Set<string>()

  for (const raw of installedNames) {
    const name = normalize(raw.trim())
    let longest = 0
    let owners: string[] = []

    for (const program of CATALOG) {
      for (const hint of program.hints) {
        if (!hintMatches(name, hint)) continue
        if (hint.length > longest) {
          longest = hint.length
          owners = [program.id]
        } else if (hint.length === longest) {
          owners.push(program.id)
        }
      }
    }

    for (const owner of owners) found.add(owner)
  }

  return CATALOG.filter((p) => found.has(p.id)).map((p) => p.id)
}

export interface CategoryGroup {
  category: Category
  programs: readonly Program[]
}

export function groupByCategory(programs: readonly Program[]): readonly CategoryGroup[] {
  return CATEGORIES.map((category) => ({
    category,
    programs: programs
      .filter((p) => p.category === category.id)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
  })).filter((g) => g.programs.length > 0)
}

export function bundleIsActive(
  bundle: Bundle,
  selected: ReadonlySet<string>,
  ignore: ReadonlySet<string> = new Set(),
): boolean {
  const ids = bundle.ids.filter((id) => !ignore.has(id))
  if (ids.length === 0) return false
  return ids.length === selected.size && ids.every((id) => selected.has(id))
}
