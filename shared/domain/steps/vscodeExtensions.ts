import { z } from 'zod'
import { countLabel, type SettingsOption } from './option'
import type { StepDescriptor } from './step'

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

export const vscodeExtensions: StepDescriptor<string[]> = {
  id: 'vscodeExtensions',
  title: 'EXTENSÕES PARA INSTALAR JUNTO',
  description:
    'Marcadas aqui, elas entram sozinhas assim que o VS Code terminar de instalar. Dá para mudar de ideia depois, dentro do próprio editor.',
  schema: z.array(z.string()),
  options: VSCODE_EXTENSIONS,
  isEmpty: (value) => value.length === 0,
  summary: (value) => [countLabel(value.length, 'extensão', 'extensões')],
}
