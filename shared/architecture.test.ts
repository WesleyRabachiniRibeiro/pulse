import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '..')
const ROOTS = ['src', 'shared', 'electron']
const CODE = /\.tsx?$/
const TEST = /\.test\.tsx?$/
const IMPORT = /(?:^|\n)\s*(?:import|export)[\s\S]*?from\s*['"]([^'"]+)['"]/g
const BARE_IMPORT = /(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g

function walk(folder: string): string[] {
  const found: string[] = []
  for (const entry of readdirSync(folder)) {
    const full = join(folder, entry)
    if (statSync(full).isDirectory()) found.push(...walk(full))
    else if (CODE.test(entry) && !TEST.test(entry)) found.push(full)
  }
  return found
}

function slug(file: string): string {
  return relative(ROOT, file).split('\\').join('/')
}

function candidates(target: string): string[] {
  return [
    `${target}.ts`,
    `${target}.tsx`,
    join(target, 'index.ts'),
    join(target, 'index.tsx'),
  ]
}

function resolveImport(from: string, source: string): string | null {
  let target: string | null = null

  if (source.startsWith('@shared/')) target = join(ROOT, 'shared', source.slice('@shared/'.length))
  else if (source.startsWith('@main/')) target = join(ROOT, 'electron', source.slice('@main/'.length))
  else if (source.startsWith('@/')) target = join(ROOT, 'src', source.slice('@/'.length))
  else if (source.startsWith('.')) target = resolve(dirname(from), source)

  if (target === null) return null

  for (const candidate of candidates(target)) {
    try {
      if (statSync(candidate).isFile()) return candidate
    } catch {}
  }

  return null
}

function importsOf(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const sources = new Set<string>()

  for (const pattern of [IMPORT, BARE_IMPORT]) {
    pattern.lastIndex = 0
    let match = pattern.exec(text)
    while (match !== null) {
      if (match[1] !== undefined) sources.add(match[1])
      match = pattern.exec(text)
    }
  }

  const resolved: string[] = []
  for (const source of sources) {
    const target = resolveImport(file, source)
    if (target !== null) resolved.push(target)
  }

  return resolved
}

function buildGraph(): Map<string, string[]> {
  const graph = new Map<string, string[]>()
  for (const folder of ROOTS) {
    for (const file of walk(join(ROOT, folder))) graph.set(file, importsOf(file))
  }
  return graph
}

function findCycle(graph: Map<string, string[]>): string[] | null {
  const visiting = new Set<string>()
  const done = new Set<string>()
  const stack: string[] = []

  function visit(file: string): string[] | null {
    if (done.has(file)) return null
    if (visiting.has(file)) return [...stack.slice(stack.indexOf(file)), file]

    visiting.add(file)
    stack.push(file)

    for (const next of graph.get(file) ?? []) {
      const cycle = visit(next)
      if (cycle) return cycle
    }

    stack.pop()
    visiting.delete(file)
    done.add(file)
    return null
  }

  for (const file of graph.keys()) {
    const cycle = visit(file)
    if (cycle) return cycle
  }

  return null
}

describe('fronteiras', () => {
  const graph = buildGraph()

  it('não tem ciclo de import', () => {
    const cycle = findCycle(graph)
    expect(cycle === null ? null : cycle.map(slug).join('\n  → ')).toBe(null)
  })

  it('enxerga os três diretórios', () => {
    const seen = ROOTS.map((folder) => [...graph.keys()].some((file) => slug(file).startsWith(folder)))
    expect(seen).toEqual([true, true, true])
  })
})
