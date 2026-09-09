import { describe, expect, it } from 'vitest'
import { getProgram } from './catalog'
import { installArgsFor, knownPackages, RUNTIME_TOOLS, runtimeToolsFor } from './runtime'

describe('catálogo de ferramentas', () => {
  it('só conhece runtime que existe no catálogo', () => {
    for (const id of Object.keys(RUNTIME_TOOLS)) {
      expect(getProgram(id), id).toBeDefined()
    }
  })

  it('todo programa com ferramentas está marcado como runtime', () => {
    for (const id of Object.keys(RUNTIME_TOOLS)) {
      expect(getProgram(id)?.settingsKind, id).toBe('runtime')
    }
  })

  it('não repete pacote dentro do mesmo runtime', () => {
    for (const [id, tools] of Object.entries(RUNTIME_TOOLS)) {
      const ids = tools.packages.map((p) => p.id)
      expect(new Set(ids).size, id).toBe(ids.length)
    }
  })

  it('todo pacote tem nome, dica e categoria', () => {
    for (const tools of Object.values(RUNTIME_TOOLS)) {
      for (const pkg of tools.packages) {
        expect(pkg.name.length).toBeGreaterThan(0)
        expect(pkg.hint.length).toBeGreaterThan(0)
        expect(pkg.category.length).toBeGreaterThan(0)
      }
    }
  })
})

describe('runtimeToolsFor', () => {
  it('acha o Node e o Python', () => {
    expect(runtimeToolsFor('node')?.runner).toBe('npm')
    expect(runtimeToolsFor('python')?.runner).toBe('pip')
  })

  it('não inventa ferramenta para quem não é runtime', () => {
    expect(runtimeToolsFor('chrome')).toBeNull()
  })
})

describe('knownPackages', () => {
  it('deixa passar só o que existe naquele runtime', () => {
    expect(knownPackages('node', ['typescript', 'ruff', 'nao-existe'])).toEqual(['typescript'])
    expect(knownPackages('python', ['ruff', 'typescript'])).toEqual(['ruff'])
  })

  it('devolve vazio quando o programa não tem ferramentas', () => {
    expect(knownPackages('chrome', ['typescript'])).toEqual([])
  })

  it('devolve vazio quando nada foi marcado', () => {
    expect(knownPackages('node', [])).toEqual([])
  })

  it('mantém a ordem do catálogo, não a ordem do clique', () => {
    const ordem = knownPackages('node', ['prettier', 'typescript'])
    expect(ordem).toEqual(['typescript', 'prettier'])
  })
})

describe('installArgsFor', () => {
  it('não monta comando quando não há pacote', () => {
    expect(installArgsFor('npm', [])).toEqual([])
    expect(installArgsFor('pip', [])).toEqual([])
  })

  it('instala tudo de uma vez pelo npm', () => {
    expect(installArgsFor('npm', ['typescript', 'pnpm'])).toEqual([
      'install',
      '--global',
      'typescript',
      'pnpm',
    ])
  })

  it('usa pip pelo módulo do python, sem precisar de administrador', () => {
    const args = installArgsFor('pip', ['ruff'])
    expect(args.slice(0, 5)).toEqual(['-m', 'pip', 'install', '--user', '--upgrade'])
    expect(args).toContain('ruff')
  })
})
