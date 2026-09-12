import type { SettingsOption } from '@pulse/catalog-data'

export type RuntimeRunner = 'npm' | 'pip'

export interface RuntimeTools {
  runner: RuntimeRunner
  note: string
  packages: readonly SettingsOption[]
}

const NODE_TOOLS: RuntimeTools = {
  runner: 'npm',
  note: 'Instalados de uma vez com npm install -g, logo depois do Node entrar.',
  packages: [
    {
      id: 'typescript',
      name: 'TypeScript',
      hint: 'o compilador tsc na linha de comando',
      category: 'Linguagem',
    },
    {
      id: 'pnpm',
      name: 'pnpm',
      hint: 'gerenciador de pacotes que reaproveita download entre projetos',
      category: 'Pacotes',
    },
    {
      id: 'yarn',
      name: 'Yarn',
      hint: 'o outro gerenciador de pacotes, para projetos que já usam',
      category: 'Pacotes',
    },
    {
      id: 'prettier',
      name: 'Prettier',
      hint: 'formata o código pela linha de comando',
      category: 'Qualidade',
    },
    {
      id: 'eslint',
      name: 'ESLint',
      hint: 'aponta erro e estilo pela linha de comando',
      category: 'Qualidade',
    },
    {
      id: 'nodemon',
      name: 'nodemon',
      hint: 'reinicia o servidor sozinho quando um arquivo muda',
      category: 'Rodar',
    },
    {
      id: 'serve',
      name: 'serve',
      hint: 'sobe uma pasta como site estático num comando',
      category: 'Rodar',
    },
  ],
}

const PYTHON_TOOLS: RuntimeTools = {
  runner: 'pip',
  note: 'Instalados com pip install --user, que não precisa de administrador.',
  packages: [
    {
      id: 'ruff',
      name: 'Ruff',
      hint: 'aponta erro e estilo, e é rápido',
      category: 'Qualidade',
    },
    {
      id: 'black',
      name: 'Black',
      hint: 'formata o código sem discussão sobre estilo',
      category: 'Qualidade',
    },
    {
      id: 'pytest',
      name: 'pytest',
      hint: 'o jeito mais comum de escrever teste em Python',
      category: 'Teste',
    },
    {
      id: 'virtualenv',
      name: 'virtualenv',
      hint: 'ambiente separado por projeto',
      category: 'Ambiente',
    },
    {
      id: 'pipx',
      name: 'pipx',
      hint: 'instala programa de linha de comando cada um no seu ambiente',
      category: 'Ambiente',
    },
  ],
}

export const RUNTIME_TOOLS: Readonly<Record<string, RuntimeTools>> = {
  node: NODE_TOOLS,
  python: PYTHON_TOOLS,
}

export function runtimeToolsFor(programId: string): RuntimeTools | null {
  return RUNTIME_TOOLS[programId] ?? null
}

// Filtra pelo catálogo do próprio runtime: um id que não é dele não vira
// argumento de linha de comando.
export function knownPackages(programId: string, ids: readonly string[]): string[] {
  const tools = runtimeToolsFor(programId)
  if (!tools) return []
  return tools.packages.filter((p) => ids.includes(p.id)).map((p) => p.id)
}

export function installArgsFor(runner: RuntimeRunner, packages: readonly string[]): string[] {
  if (packages.length === 0) return []
  if (runner === 'npm') return ['install', '--global', ...packages]
  return ['-m', 'pip', 'install', '--user', '--upgrade', ...packages]
}
