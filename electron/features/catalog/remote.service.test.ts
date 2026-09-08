import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPrograms, hasProgram, type Catalog } from '@shared/domain/catalog'

let userData = ''

vi.mock('electron', () => ({
  app: { getPath: (): string => userData },
}))

const { forgetRemoteCatalog, loadCatalog, refreshCatalog, subscribe } = await import(
  './remote.service'
)

const remote: Catalog = {
  version: 1,
  categories: [{ id: 'tools', name: 'FERRAMENTAS' }],
  programs: [
    {
      id: 'sete-zip',
      name: '7-Zip',
      winget: '7zip.7zip',
      version: '26.02',
      mb: 5,
      category: 'tools',
      hints: ['7-zip'],
    },
  ],
}

function file(): string {
  return join(userData, 'catalog.json')
}

function answers(body: unknown, ok = true): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) })),
  )
}

function refuses(): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('sem rede'))),
  )
}

beforeEach(async () => {
  userData = await mkdtemp(join(tmpdir(), 'pulse-catalog-'))
  forgetRemoteCatalog()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  forgetRemoteCatalog()
  await rm(userData, { recursive: true, force: true })
})

describe('loadCatalog', () => {
  it('começa com o catálogo embutido quando não há cache', async () => {
    const carregado = await loadCatalog()
    expect(carregado.programs.length).toBeGreaterThan(1)
    expect(hasProgram('chrome')).toBe(true)
  })

  it('usa o cache do disco quando existe', async () => {
    await writeFile(file(), JSON.stringify(remote), 'utf8')
    const carregado = await loadCatalog()
    expect(carregado.programs.map((p) => p.id)).toEqual(['sete-zip'])
  })

  it('ignora cache corrompido', async () => {
    await writeFile(file(), 'nem json é', 'utf8')
    await loadCatalog()
    expect(hasProgram('chrome')).toBe(true)
  })

  it('ignora cache fora do formato', async () => {
    await writeFile(file(), JSON.stringify({ version: 99, programs: [] }), 'utf8')
    await loadCatalog()
    expect(hasProgram('chrome')).toBe(true)
  })

  it('lê o disco uma vez só', async () => {
    await writeFile(file(), JSON.stringify(remote), 'utf8')
    const primeiro = await loadCatalog()
    await rm(file())
    const segundo = await loadCatalog()
    expect(segundo).toBe(primeiro)
  })
})

describe('refreshCatalog', () => {
  it('adota o catálogo que veio da rede e guarda em disco', async () => {
    answers(remote)

    await expect(refreshCatalog()).resolves.toBe(true)
    expect(getPrograms().map((p) => p.id)).toEqual(['sete-zip'])

    const gravado: unknown = JSON.parse(await readFile(file(), 'utf8'))
    expect(gravado).toMatchObject({ programs: [{ id: 'sete-zip' }] })
  })

  it('avisa quem estiver escutando', async () => {
    answers(remote)
    const ouviu = vi.fn()
    const stop = subscribe(ouviu)

    await refreshCatalog()
    stop()

    expect(ouviu).toHaveBeenCalledTimes(1)
    expect(ouviu.mock.calls[0]?.[0]?.programs).toHaveLength(1)
  })

  it('fica no embutido quando a rede falha', async () => {
    refuses()
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(hasProgram('chrome')).toBe(true)
  })

  it('fica no embutido quando o servidor responde erro', async () => {
    answers(remote, false)
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(hasProgram('chrome')).toBe(true)
  })

  it('recusa catálogo com id repetido', async () => {
    answers({ ...remote, programs: [...remote.programs, ...remote.programs] })
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(hasProgram('chrome')).toBe(true)
  })

  it('recusa catálogo com expressão de família quebrada', async () => {
    answers({
      ...remote,
      programs: [{ ...remote.programs[0], family: { prefix: 'x', pattern: '([' } }],
    })
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(hasProgram('chrome')).toBe(true)
  })

  it('não sobrescreve o cache bom com resposta ruim', async () => {
    answers(remote)
    await refreshCatalog()

    forgetRemoteCatalog()
    refuses()
    await refreshCatalog()

    const gravado: unknown = JSON.parse(await readFile(file(), 'utf8'))
    expect(gravado).toMatchObject({ programs: [{ id: 'sete-zip' }] })
  })
})
