import { z } from 'zod'
import { settingsKindSchema } from './settings'

export type CategoryId = string

export const categorySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
})
export type Category = z.infer<typeof categorySchema>

export const programSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  winget: z.string().min(1).optional(),
  source: z.enum(['msstore', 'pages']).optional(),
  version: z.string(),
  mb: z.number().min(0),
  category: z.string().min(1),
  hints: z.array(z.string()),
  notice: z.string().optional(),
  settingsKind: settingsKindSchema.optional(),
  family: z
    .object({
      prefix: z.string().min(1),
      pattern: z.string().min(1),
    })
    .optional(),
})
export type Program = z.infer<typeof programSchema>

export const bundleSchema = z.object({
  name: z.string().min(1),
  ids: z.array(z.string()),
})
export type Bundle = z.infer<typeof bundleSchema>

export const CATALOG_VERSION = 1

export const catalogSchema = z.object({
  version: z.literal(CATALOG_VERSION),
  categories: z.array(categorySchema).min(1),
  programs: z.array(programSchema).min(1),
  bundles: z.array(bundleSchema).optional(),
})
export type Catalog = z.infer<typeof catalogSchema>

export const BUILTIN_CATEGORIES: readonly Category[] = [
  { id: 'browsers', name: 'NAVEGADORES' },
  { id: 'games', name: 'GAMES' },
  { id: 'media', name: 'COMUNICAÇÃO E MÍDIA' },
  { id: 'office', name: 'ESCRITÓRIO E ESTUDO' },
  { id: 'utilities', name: 'UTILIDADES' },
  { id: 'creative', name: 'CRIAÇÃO' },
  { id: 'security', name: 'SEGURANÇA' },
  { id: 'dev', name: 'DESENVOLVIMENTO' },
]

export const BUILTIN_PROGRAMS: readonly Program[] = [
  { id: 'chrome', name: 'Google Chrome', winget: 'Google.Chrome', version: '152.0.7977', mb: 118, category: 'browsers', hints: ['google chrome'], settingsKind: 'browser' },
  { id: 'firefox', name: 'Mozilla Firefox', winget: 'Mozilla.Firefox', version: '155.0.1', mb: 62, category: 'browsers', hints: ['mozilla firefox'], settingsKind: 'browser' },
  { id: 'brave', name: 'Brave', winget: 'Brave.Brave', version: '152.1.94', mb: 145, category: 'browsers', hints: ['brave'], settingsKind: 'browser' },
  { id: 'operagx', name: 'Opera GX', winget: 'Opera.OperaGX', version: '135.0.5973', mb: 98, category: 'browsers', hints: ['opera gx'], settingsKind: 'browser' },

  { id: 'steam', name: 'Steam', winget: 'Valve.Steam', version: '2.10.91', mb: 320, category: 'games', hints: ['steam'], settingsKind: 'steam' },
  { id: 'epic', name: 'Epic Games', winget: 'EpicGames.EpicGamesLauncher', version: '1.3.193', mb: 210, category: 'games', hints: ['epic games launcher'] },
  { id: 'minecraft', name: 'Minecraft Launcher', winget: 'Mojang.MinecraftLauncher', version: '2.0.0', mb: 45, category: 'games', hints: ['minecraft launcher'] },
  { id: 'riot', name: 'Riot Client', winget: 'RiotGames.LeagueOfLegends.BR', version: '138.0.0', mb: 76, category: 'games', hints: ['riot client', 'league of legends'], settingsKind: 'riot' },
  { id: 'battlenet', name: 'Battle.net', winget: 'Blizzard.BattleNet', version: '1.19.3', mb: 90, category: 'games', hints: ['battle.net'] },
  { id: 'roblox', name: 'Roblox', winget: 'Roblox.Roblox', version: '0.726', mb: 120, category: 'games', hints: ['roblox player'] },
  { id: 'gog', name: 'GOG Galaxy', winget: 'GOG.Galaxy', version: '2.1.8', mb: 260, category: 'games', hints: ['gog galaxy'] },
  { id: 'hytale', name: 'Hytale Launcher', winget: 'HypixelStudios.Hytale', version: '2026.08.28', mb: 90, category: 'games', hints: ['hytale'] },
  { id: 'eaapp', name: 'EA app', winget: 'ElectronicArts.EADesktop', version: '13.783', mb: 180, category: 'games', hints: ['ea app', 'ea desktop'] },
  { id: 'ubisoft', name: 'Ubisoft Connect', winget: 'Ubisoft.Connect', version: '173.1.0', mb: 130, category: 'games', hints: ['ubisoft connect'] },
  { id: 'tibia', name: 'Tibia', source: 'pages', version: 'vários clientes', mb: 0, category: 'games', hints: [], settingsKind: 'tibia' },
  { id: 'radminvpn', name: 'Radmin VPN', winget: 'Famatech.RadminVPN', version: '2.0.4899', mb: 15, category: 'games', hints: ['radmin vpn'] },

  { id: 'discord', name: 'Discord', winget: 'Discord.Discord', version: '1.0.9256', mb: 92, category: 'media', hints: ['discord'] },
  { id: 'spotify', name: 'Spotify', winget: 'Spotify.Spotify', version: '1.2.98', mb: 140, category: 'media', hints: ['spotify'] },
  { id: 'telegram', name: 'Telegram', winget: 'Telegram.TelegramDesktop', version: '7.2.5', mb: 55, category: 'media', hints: ['telegram desktop', 'telegram'] },
  { id: 'teamspeak', name: 'TeamSpeak 3', winget: 'TeamSpeakSystems.TeamSpeakClient', version: '3.6.2', mb: 70, category: 'media', hints: ['teamspeak'] },
  { id: 'teams', name: 'Microsoft Teams', winget: 'Microsoft.Teams', version: '26198.304', mb: 130, category: 'media', hints: ['microsoft teams'] },
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
  { id: 'acrobat', name: 'Acrobat Reader', winget: 'Adobe.Acrobat.Reader.64-bit', version: '26.002', mb: 300, category: 'media', hints: ['acrobat reader', 'adobe acrobat'] },
  {
    id: 'adobecc',
    name: 'Adobe Creative Cloud',
    winget: 'Adobe.CreativeCloud',
    version: '6.10.0',
    mb: 500,
    category: 'media',
    hints: ['adobe creative cloud'],
    notice:
      'O Pulse instala o painel da Adobe, não os programas dela. Photoshop, Illustrator, Premiere e os outros são baixados de dentro do painel, depois que você entra na sua conta e com uma assinatura ativa. A Adobe não publica esses programas para instalação automática, então essa parte fica com você.',
  },
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

  { id: 'libreoffice', name: 'LibreOffice', winget: 'TheDocumentFoundation.LibreOffice', version: '26.8.0', mb: 380, category: 'office', hints: ['libreoffice'] },
  { id: 'zoom', name: 'Zoom', winget: 'Zoom.Zoom', version: '7.1.46825', mb: 60, category: 'office', hints: ['zoom'] },
  { id: 'thunderbird', name: 'Thunderbird', winget: 'Mozilla.Thunderbird', version: '155.0', mb: 90, category: 'office', hints: ['mozilla thunderbird', 'thunderbird'] },
  { id: 'anki', name: 'Anki', winget: 'Anki.Anki', version: '26.08.1', mb: 130, category: 'office', hints: ['anki'] },
  { id: 'notion', name: 'Notion', winget: 'Notion.Notion', version: '7.32.1', mb: 120, category: 'office', hints: ['notion'] },

  { id: 'vlc', name: 'VLC', winget: 'VideoLAN.VLC', version: '3.0.23', mb: 42, category: 'media', hints: ['vlc media player', 'vlc'] },
  { id: 'signal', name: 'Signal', winget: 'OpenWhisperSystems.Signal', version: '8.26.0', mb: 190, category: 'media', hints: ['signal'] },

  { id: 'sevenzip', name: '7-Zip', winget: '7zip.7zip', version: '26.02', mb: 6, category: 'utilities', hints: ['7-zip'] },
  { id: 'sharex', name: 'ShareX', winget: 'ShareX.ShareX', version: '21.0.0', mb: 40, category: 'utilities', hints: ['sharex'] },
  { id: 'qbittorrent', name: 'qBittorrent', winget: 'qBittorrent.qBittorrent', version: '5.2.3', mb: 40, category: 'utilities', hints: ['qbittorrent'] },

  { id: 'gimp', name: 'GIMP', winget: 'GIMP.GIMP', version: '3.2.4', mb: 320, category: 'creative', hints: ['gimp'] },
  { id: 'inkscape', name: 'Inkscape', winget: 'Inkscape.Inkscape', version: '1.4.4', mb: 300, category: 'creative', hints: ['inkscape'] },
  { id: 'krita', name: 'Krita', winget: 'KDE.Krita', version: '5.3.3', mb: 320, category: 'creative', hints: ['krita'] },
  { id: 'figma', name: 'Figma', winget: 'Figma.Figma', version: '126.8.16', mb: 140, category: 'creative', hints: ['figma'] },
  { id: 'audacity', name: 'Audacity', winget: 'Audacity.Audacity', version: '4.0.0', mb: 130, category: 'creative', hints: ['audacity'] },

  { id: 'bitwarden', name: 'Bitwarden', winget: 'Bitwarden.Bitwarden', version: '2026.8.0', mb: 110, category: 'security', hints: ['bitwarden'] },
  { id: 'malwarebytes', name: 'Malwarebytes', winget: 'Malwarebytes.Malwarebytes', version: '5.6.5', mb: 260, category: 'security', hints: ['malwarebytes'] },
  { id: 'wireshark', name: 'Wireshark', winget: 'WiresharkFoundation.Wireshark', version: '4.6.8', mb: 230, category: 'security', hints: ['wireshark'] },

  { id: 'rockstar', name: 'Rockstar Games Launcher', winget: 'RockstarGames.Launcher', version: '1.0.109', mb: 120, category: 'games', hints: ['rockstar games launcher'] },
  { id: 'itch', name: 'itch', winget: 'ItchIo.Itch', version: '26.20.0', mb: 130, category: 'games', hints: ['itch'] },
  { id: 'corsair', name: 'Corsair iCUE', winget: 'Corsair.iCUE.5', version: '5.49.34', mb: 700, category: 'games', hints: ['corsair icue', 'icue'] },

  { id: 'pycharm', name: 'PyCharm CE', winget: 'JetBrains.PyCharm.Community', version: '2025.2.6', mb: 720, category: 'dev', hints: ['pycharm community edition', 'pycharm'] },
  { id: 'webstorm', name: 'WebStorm', winget: 'JetBrains.WebStorm', version: '2026.2.2', mb: 850, category: 'dev', hints: ['webstorm'] },
  { id: 'rider', name: 'Rider', winget: 'JetBrains.Rider', version: '2026.2.0', mb: 1600, category: 'dev', hints: ['jetbrains rider', 'rider'] },
  { id: 'androidstudio', name: 'Android Studio', winget: 'Google.AndroidStudio', version: '2026.1.4', mb: 1200, category: 'dev', hints: ['android studio'] },
  { id: 'sublimetext', name: 'Sublime Text', winget: 'SublimeHQ.SublimeText.4', version: '4', mb: 40, category: 'dev', hints: ['sublime text'] },
  { id: 'neovim', name: 'Neovim', winget: 'Neovim.Neovim', version: '0.12.5', mb: 40, category: 'dev', hints: ['neovim'] },
  { id: 'notepadpp', name: 'Notepad++', winget: 'Notepad++.Notepad++', version: '8.9.8', mb: 20, category: 'dev', hints: ['notepad++'] },
  { id: 'cursor', name: 'Cursor', winget: 'Anysphere.Cursor', version: '3.19.7', mb: 400, category: 'dev', hints: ['cursor'] },
  { id: 'zed', name: 'Zed', winget: 'ZedIndustries.Zed', version: '1.18.1', mb: 130, category: 'dev', hints: ['zed'] },
  { id: 'dotnet', name: '.NET SDK', winget: 'Microsoft.DotNet.SDK.9', version: '9', mb: 320, category: 'dev', hints: ['microsoft .net sdk'] },
  { id: 'rust', name: 'Rust', winget: 'Rustlang.Rustup', version: '1.29.1', mb: 20, category: 'dev', hints: ['rustup'] },
  { id: 'postgresql', name: 'PostgreSQL', winget: 'PostgreSQL.PostgreSQL.17', version: '17', mb: 320, category: 'dev', hints: ['postgresql'] },
  { id: 'mysql', name: 'MySQL', winget: 'Oracle.MySQL', version: '8.4.9', mb: 400, category: 'dev', hints: ['mysql server', 'mysql'] },
  { id: 'mongodb', name: 'MongoDB Compass', winget: 'MongoDB.Compass.Full', version: '1.50.0', mb: 200, category: 'dev', hints: ['mongodb compass'] },
  { id: 'dbeaver', name: 'DBeaver', winget: 'DBeaver.DBeaver.Community', version: '26.2.0', mb: 240, category: 'dev', hints: ['dbeaver'] },
  { id: 'redisinsight', name: 'Redis Insight', winget: 'RedisInsight.RedisInsight', version: '3.4.2', mb: 200, category: 'dev', hints: ['redis insight', 'redisinsight'] },
  { id: 'terraform', name: 'Terraform', winget: 'Hashicorp.Terraform', version: '1.15.8', mb: 90, category: 'dev', hints: ['terraform'] },
  { id: 'kubectl', name: 'kubectl', winget: 'Kubernetes.kubectl', version: '1.37.0', mb: 55, category: 'dev', hints: ['kubectl'] },
]

export const packageVersionSchema = z.object({
  winget: z.string(),
  name: z.string(),
  version: z.string(),
  recommended: z.boolean(),
})
export type PackageVersion = z.infer<typeof packageVersionSchema>

export function compareVersions(a: PackageVersion, b: PackageVersion): number {
  const key = ({ winget, version }: PackageVersion): number[] => {
    if (winget.toUpperCase().endsWith('.LTS')) return [Number.MAX_SAFE_INTEGER]
    const fromId = winget.match(/\d+/g)
    return (fromId ?? version.match(/\d+/g) ?? ['0']).map(Number)
  }

  const na = key(a)
  const nb = key(b)

  for (let i = 0; i < Math.max(na.length, nb.length); i++) {
    const difference = (na[i] ?? 0) - (nb[i] ?? 0)
    if (difference !== 0) return difference
  }
  return 0
}

export function sortVersions(versions: readonly PackageVersion[]): PackageVersion[] {
  return [...versions].sort((a, b) => compareVersions(b, a))
}

const UNKNOWN_VERSIONS = ['unknown', 'desconhecido', 'desconhecida']

export function readVersionFromSearch(output: string, wingetId: string): string | null {
  const wanted = wingetId.toLowerCase()

  for (const line of output.split(/\r?\n/)) {
    const tokens = line.trim().split(/\s+/)
    const position = tokens.findIndex((t) => t.toLowerCase() === wanted)
    if (position <= 0) continue

    const version = tokens[position + 1]
    if (!version || UNKNOWN_VERSIONS.includes(version.toLowerCase())) return null
    return version
  }

  return null
}

export const EVERYTHING_BUNDLE = 'Tudo'

export const BUILTIN_BUNDLES: readonly Bundle[] = [
  { name: 'Essencial', ids: ['chrome', 'discord', 'spotify'] },
  {
    name: 'Setup gamer',
    ids: ['operagx', 'steam', 'epic', 'battlenet', 'minecraft', 'riot', 'discord', 'spotify'],
  },
  {
    name: 'Trabalho e código',
    ids: ['chrome', 'vscode', 'gitbash', 'node', 'python', 'postman', 'claude', 'claudecode', 'docker', 'discord'],
  },
]

export const BUILTIN_CATALOG: Catalog = {
  version: CATALOG_VERSION,
  categories: [...BUILTIN_CATEGORIES],
  programs: [...BUILTIN_PROGRAMS],
  bundles: [...BUILTIN_BUNDLES],
}

interface Registry {
  catalog: Catalog
  byId: Map<string, Program>
  bundles: readonly Bundle[]
}

function build(catalog: Catalog): Registry {
  const programs = catalog.programs.filter((p) =>
    catalog.categories.some((c) => c.id === p.category),
  )
  const byId = new Map(programs.map((p) => [p.id, p]))

  const known = (id: string): boolean => byId.has(id)
  const listed = (catalog.bundles ?? [])
    .filter((b) => b.name !== EVERYTHING_BUNDLE)
    .map((b) => ({ name: b.name, ids: b.ids.filter(known) }))
    .filter((b) => b.ids.length > 0)

  return {
    catalog: { ...catalog, programs },
    byId,
    bundles: [...listed, { name: EVERYTHING_BUNDLE, ids: programs.map((p) => p.id) }],
  }
}

let registry = build(BUILTIN_CATALOG)

export function setCatalog(catalog: Catalog): void {
  registry = build(catalog)
}

export function resetCatalog(): void {
  registry = build(BUILTIN_CATALOG)
}

export function getCatalog(): Catalog {
  return registry.catalog
}

export function getPrograms(): readonly Program[] {
  return registry.catalog.programs
}

export function getCategories(): readonly Category[] {
  return registry.catalog.categories
}

export function getBundles(): readonly Bundle[] {
  return registry.bundles
}

export function getProgram(id: string): Program | undefined {
  return registry.byId.get(id)
}

export function hasProgram(id: string): boolean {
  return registry.byId.has(id)
}

export function formatMb(mb: number): string {
  if (mb >= 1024) {
    return `${(mb / 1024).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB`
  }
  return `${mb.toLocaleString('pt-BR')} MB`
}

export function totalSizeMb(ids: Iterable<string>): number {
  let total = 0
  for (const id of ids) total += getProgram(id)?.mb ?? 0
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
  const programs = getPrograms()
  if (!needle) return programs

  const categoryNames = new Map(getCategories().map((c) => [c.id, normalize(c.name)]))
  return programs.filter(
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

    for (const program of getPrograms()) {
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

  return getPrograms().filter((p) => found.has(p.id)).map((p) => p.id)
}

export interface CategoryGroup {
  category: Category
  programs: readonly Program[]
}

export function groupByCategory(programs: readonly Program[]): readonly CategoryGroup[] {
  return getCategories().map((category) => ({
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
