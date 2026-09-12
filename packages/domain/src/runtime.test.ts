import { describe, expect, it } from 'vitest'
import { installArgsFor, knownPackages, RUNTIME_TOOLS, runtimeToolsFor } from './runtime'

describe('ferramentas de runtime', () => {
  it('só Node e Python oferecem ferramentas', () => {
    expect(runtimeToolsFor('node')?.runner).toBe('npm')
    expect(runtimeToolsFor('python')?.runner).toBe('pip')
    expect(runtimeToolsFor('vscode')).toBeNull()
  })

  it('cada catálogo tem ids únicos', () => {
    for (const [id, tools] of Object.entries(RUNTIME_TOOLS)) {
      const ids = tools.packages.map((p) => p.id)
      expect(new Set(ids).size, `${id} tem id repetido`).toBe(ids.length)
    }
  })

  // Um id que não é do catálogo daquele runtime não pode chegar à linha de
  // comando, nem o de outro runtime.
  it('filtra o que não é do runtime pedido', () => {
    expect(knownPackages('node', ['pnpm', 'ruff', 'inventado'])).toEqual(['pnpm'])
    expect(knownPackages('python', ['pnpm', 'ruff'])).toEqual(['ruff'])
    expect(knownPackages('vscode', ['pnpm'])).toEqual([])
  })

  it('a ordem é a do catálogo, não a da escolha', () => {
    expect(knownPackages('node', ['pnpm', 'typescript'])).toEqual(['typescript', 'pnpm'])
    expect(knownPackages('node', ['typescript', 'pnpm'])).toEqual(['typescript', 'pnpm'])
  })

  it('cada gerenciador tem os seus argumentos', () => {
    expect(installArgsFor('npm', ['a', 'b'])).toEqual(['install', '--global', 'a', 'b'])
    expect(installArgsFor('pip', ['a'])).toEqual(['-m', 'pip', 'install', '--user', '--upgrade', 'a'])
  })

  it('sem pacote, não há comando', () => {
    expect(installArgsFor('npm', [])).toEqual([])
    expect(installArgsFor('pip', [])).toEqual([])
  })
})
