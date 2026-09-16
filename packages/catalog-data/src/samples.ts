import type { Bundle, Category, Program } from './types'

export const SAMPLE_CATEGORIES: readonly Category[] = [
  { id: 'browsers', name: 'NAVEGADORES' },
  { id: 'games', name: 'GAMES' },
  { id: 'media', name: 'COMUNICAÇÃO E MÍDIA' },
  { id: 'dev', name: 'DESENVOLVIMENTO' },
]

export const SAMPLE_PROGRAMS: readonly Program[] = [
  { id: 'chrome', name: 'Google Chrome', winget: 'Google.Chrome', version: '153.0.8010.37', mb: 153, category: 'browsers', hints: ['google chrome'], settingsKind: 'browser' },
  { id: 'firefox', name: 'Mozilla Firefox', winget: 'Mozilla.Firefox', version: '155.0.1', mb: 87, category: 'browsers', hints: ['mozilla firefox'], settingsKind: 'browser' },
  { id: 'edge', name: 'Microsoft Edge', winget: 'Microsoft.Edge', version: '153.0.4234.32', mb: 203, category: 'browsers', hints: ['microsoft edge'] },
  { id: 'steam', name: 'Steam', winget: 'Valve.Steam', version: '2.10.91.91', mb: 320, category: 'games', hints: ['steam'], settingsKind: 'steam' },
  { id: 'riot', name: 'Riot Client', winget: 'RiotGames.LeagueOfLegends.BR', version: '138.0.0.4786', mb: 72, category: 'games', hints: ['riot client', 'league of legends'], settingsKind: 'riot' },
  { id: 'tibia', name: 'Tibia', source: 'pages', version: 'vários clientes', mb: 0, category: 'games', hints: [], settingsKind: 'tibia' },
  { id: 'discord', name: 'Discord', winget: 'Discord.Discord', version: '1.0.9258', mb: 139, category: 'media', hints: ['discord'] },
  { id: 'spotify', name: 'Spotify', winget: 'Spotify.Spotify', version: '1.3.0.277.g5441bb3e', mb: 140, category: 'media', hints: ['spotify'] },
  { id: 'vscode', name: 'VS Code', winget: 'Microsoft.VisualStudioCode', version: '1.137.0', mb: 224, category: 'dev', hints: ['microsoft visual studio code'], settingsKind: 'vscode' },
  { id: 'gitbash', name: 'Git Bash', winget: 'Git.Git', version: '2.55.0.3', mb: 62, category: 'dev', hints: ['git'], settingsKind: 'git' },
  { id: 'vs', name: 'Visual Studio', winget: 'Microsoft.VisualStudio.Community', version: '18.10.1', mb: 1800, category: 'dev', hints: ['visual studio community'], settingsKind: 'vs' },
  { id: 'claudecode', name: 'Claude Code', winget: 'Anthropic.ClaudeCode', version: '2.1.268', mb: 211, category: 'dev', hints: ['claude code'] },
  { id: 'node', name: 'Node.js', winget: 'OpenJS.NodeJS.LTS', version: '24.19.0', mb: 30, category: 'dev', hints: ['node.js'], steps: ['runtimePackages'], family: { prefix: 'OpenJS.NodeJS', pattern: '^OpenJS\\.NodeJS(\\.LTS|\\.\\d+)?$' } },
]

export const SAMPLE_BY_ID: ReadonlyMap<string, Program> = new Map(
  SAMPLE_PROGRAMS.map((program) => [program.id, program]),
)

export const SAMPLE_BUNDLES: readonly Bundle[] = [
  { name: 'Essencial', ids: ['chrome', 'discord', 'spotify'] },
  { name: 'Setup gamer', ids: ['steam', 'riot', 'discord', 'spotify'] },
  { name: 'Trabalho e código', ids: ['chrome', 'vscode', 'gitbash', 'node', 'claudecode'] },
  { name: 'Tudo', ids: SAMPLE_PROGRAMS.map((p) => p.id) },
]
