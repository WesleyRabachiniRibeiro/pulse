import { readdirSync, statSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname)
const CODE = /\.tsx?$/
const TEST = /\.test\.tsx?$/
const SKIP = new Set(['node_modules', 'out', 'dist', 'build', '.git', 'resources'])

// Pega `from '...'`, `import '...'` e `await import('...')` numa varredura só.
const SOURCES = [
  /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g,
  /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
]

// Uma aresta só pode apontar para um posto menor. É isso que mantém o grafo de
// pacotes acíclico e impede o `ERR_PNPM_TASK_CYCLE` de voltar.
const RANK: Readonly<Record<string, number>> = {
  '@pulse/catalog-data': 0,
  '@pulse/domain': 1,
  '@pulse/utils': 2,
  '@pulse/ipc-contract': 3,
  desktop: 4,
}

const PACKAGE_OF: Readonly<Record<string, string>> = {
  'packages/catalog-data': '@pulse/catalog-data',
  'packages/domain': '@pulse/domain',
  'packages/utils': '@pulse/utils',
  'packages/ipc-contract': '@pulse/ipc-contract',
  'apps/desktop': 'desktop',
}

function walk(folder: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(folder)) {
    if (SKIP.has(entry)) continue
    const full = join(folder, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (CODE.test(entry)) found.push(full)
  }
  return found
}

function slug(file: string): string {
  return relative(ROOT, file).split('\\').join('/')
}

function ownerOf(path: string): string | null {
  for (const [folder, name] of Object.entries(PACKAGE_OF)) {
    if (path.startsWith(`${folder}/`)) return name
  }
  return null
}

async function importsOf(file: string): Promise<string[]> {
  const text = await readFile(file, 'utf8')
  const found: string[] = []

  for (const pattern of SOURCES) {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      if (match[1]) found.push(match[1])
    }
  }

  return found
}

interface Edge {
  from: string
  to: string
}

const FILES = [
  ...walk(join(ROOT, 'packages')),
  ...walk(join(ROOT, 'apps', 'desktop', 'src')),
].map(slug)

async function edges(where: (file: string) => boolean): Promise<Edge[]> {
  const found: Edge[] = []
  for (const file of FILES.filter(where)) {
    for (const source of await importsOf(join(ROOT, file))) {
      found.push({ from: file, to: source })
    }
  }
  return found
}

function resolveRelative(from: string, source: string): string {
  const folder = from.split('/').slice(0, -1).join('/')
  const parts = [...folder.split('/'), ...source.split('/')]
  const stack: string[] = []

  for (const part of parts) {
    if (part === '.' || part === '') continue
    if (part === '..') stack.pop()
    else stack.push(part)
  }

  return stack.join('/')
}

describe('limites entre pacotes', () => {
  it('nenhum pacote importa outro de posto igual ou maior', async () => {
    const broken: string[] = []

    for (const { from, to } of await edges(() => true)) {
      if (!to.startsWith('@pulse/')) continue

      const owner = ownerOf(from)
      const target = RANK[to]
      if (owner === null || target === undefined) continue

      const mine = RANK[owner]
      if (mine !== undefined && target >= mine) {
        broken.push(`${from} importa ${to}`)
      }
    }

    expect(broken).toEqual([])
  })

  it('o que o código importa está declarado no package.json', async () => {
    const broken: string[] = []

    for (const [folder, name] of Object.entries(PACKAGE_OF)) {
      const manifest = JSON.parse(await readFile(join(ROOT, folder, 'package.json'), 'utf8')) as {
        dependencies?: Record<string, string>
      }
      const declared = new Set(Object.keys(manifest.dependencies ?? {}))

      for (const { from, to } of await edges((f) => ownerOf(f) === name)) {
        if (to.startsWith('@pulse/') && !declared.has(to)) {
          broken.push(`${from} importa ${to}, que não está em ${folder}/package.json`)
        }
      }
    }

    expect(broken).toEqual([])
  })
})

describe('limites dentro do main', () => {
  it('application não importa infra', async () => {
    const broken: string[] = []

    const inApplication = (file: string): boolean =>
      file.startsWith('apps/desktop/src/main/application/') && !TEST.test(file)

    for (const { from, to } of await edges(inApplication)) {
      if (!to.startsWith('.')) continue
      if (resolveRelative(from, to).includes('/main/infra/')) {
        broken.push(`${from} importa ${to}`)
      }
    }

    expect(broken).toEqual([])
  })

  it('domain não conhece electron nem node', async () => {
    const broken: string[] = []

    for (const { from, to } of await edges((f) => f.startsWith('packages/domain/'))) {
      if (to.startsWith('node:') || to === 'electron') {
        broken.push(`${from} importa ${to}`)
      }
    }

    expect(broken).toEqual([])
  })
})

describe('limites do renderer', () => {
  // O teste fica de fora como na application: a regra existe para o código que
  // embarca no bundle, e teste de renderer roda no node.
  const inRenderer = (file: string): boolean =>
    file.startsWith('apps/desktop/src/renderer/') && !TEST.test(file)

  it('não importa node nem electron', async () => {
    const broken: string[] = []

    for (const { from, to } of await edges(inRenderer)) {
      if (to.startsWith('node:') || to === 'electron') {
        broken.push(`${from} importa ${to}`)
      }
    }

    expect(broken).toEqual([])
  })

  it('não alcança o processo main', async () => {
    const broken: string[] = []

    for (const { from, to } of await edges(inRenderer)) {
      if (to.startsWith('.') && resolveRelative(from, to).includes('/src/main/')) {
        broken.push(`${from} importa ${to}`)
      }
      if (to.includes('/main/')) broken.push(`${from} importa ${to}`)
    }

    expect(broken).toEqual([])
  })
})

describe('quem fala com o sistema operacional', () => {
  it('só os dois runners dão spawn', async () => {
    const allowed = new Set([
      'apps/desktop/src/main/infra/process/WindowsProcessRunner.ts',
      'apps/desktop/src/main/infra/powershell/NodePowerShellRunner.ts',
    ])
    const broken: string[] = []

    for (const { from, to } of await edges((f) => !TEST.test(f))) {
      if (to === 'node:child_process' && !allowed.has(from)) broken.push(from)
    }

    expect(broken).toEqual([])
  })
})
