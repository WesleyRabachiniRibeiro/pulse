import type { SettingsOption } from './types'

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
