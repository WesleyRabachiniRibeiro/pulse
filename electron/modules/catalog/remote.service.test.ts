import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  catalogIsEmpty,
  getProgram,
  getPrograms,
  hasProgram,
  type Catalog,
} from '@shared/domain/catalog'
import { BUILTIN_CATALOG } from '@shared/domain/catalog.seed'

let userData = ''

let stored: Record<string, string> = {}
let swept: Record<string, string> | null = null

vi.mock('electron', () => ({
  app: { getPath: (): string => userData },
}))

vi.mock('./versions.service', () => ({
  forgetVersions: (): void => undefined,
  knownVersions: (): Promise<Record<string, string>> => Promise.resolve(stored),
  refreshVersions: (): Promise<Record<string, string> | null> => Promise.resolve(swept),
}))

const {
  forgetRemoteCatalog,
  loadCatalog,
  refreshCatalog,
  refreshVersionsFromWinget,
  subscribe,
} = await import('./remote.service')

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
  stored = {}
  swept = null
  forgetRemoteCatalog()
})

afterEach(async () => {
  vi.unstubAllGlobals()
  forgetRemoteCatalog()
  await rm(userData, { recursive: true, force: true })
})

describe('loadCatalog', () => {
  it('começa vazio quando não há cache nem rede', async () => {
    const carregado = await loadCatalog()
    expect(carregado.programs).toEqual([])
    expect(catalogIsEmpty()).toBe(true)
  })

  it('usa o cache do disco quando existe', async () => {
    await writeFile(file(), JSON.stringify(remote), 'utf8')
    const carregado = await loadCatalog()
    expect(carregado.programs.map((p) => p.id)).toEqual(['sete-zip'])
  })

  it('ignora cache corrompido e continua vazio', async () => {
    await writeFile(file(), 'nem json é', 'utf8')
    await loadCatalog()
    expect(catalogIsEmpty()).toBe(true)
  })

  it('ignora cache fora do formato e continua vazio', async () => {
    await writeFile(file(), JSON.stringify({ version: 99, programs: [] }), 'utf8')
    await loadCatalog()
    expect(catalogIsEmpty()).toBe(true)
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

  it('fica com o cache quando a rede falha', async () => {
    await writeFile(file(), JSON.stringify(remote), 'utf8')
    refuses()
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(hasProgram('sete-zip')).toBe(true)
  })

  it('fica com o cache quando o servidor responde erro', async () => {
    await writeFile(file(), JSON.stringify(remote), 'utf8')
    answers(remote, false)
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(hasProgram('sete-zip')).toBe(true)
  })

  it('sem cache e com a rede fora, fica vazio em vez de inventar lista', async () => {
    refuses()
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(catalogIsEmpty()).toBe(true)
  })

  it('recusa catálogo com id repetido', async () => {
    answers({ ...remote, programs: [...remote.programs, ...remote.programs] })
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(catalogIsEmpty()).toBe(true)
  })

  it('recusa catálogo com expressão de família quebrada', async () => {
    answers({
      ...remote,
      programs: [{ ...remote.programs[0], family: { prefix: 'x', pattern: '([' } }],
    })
    await expect(refreshCatalog()).resolves.toBe(false)
    expect(catalogIsEmpty()).toBe(true)
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

describe('versão vinda do winget', () => {
  it('aplica na abertura o que já estava guardado', async () => {
    await writeFile(file(), JSON.stringify(BUILTIN_CATALOG), 'utf8')
    stored = { vim: '9.9.9' }
    await loadCatalog()
    expect(getProgram('vim')?.version).toBe('9.9.9')
  })

  it('substitui a versão do catálogo pela que o winget respondeu', async () => {
    await writeFile(file(), JSON.stringify(BUILTIN_CATALOG), 'utf8')
    swept = { vim: '9.9.9' }
    await expect(refreshVersionsFromWinget()).resolves.toBe(true)
    expect(getProgram('vim')?.version).toBe('9.9.9')
  })

  it('deixa como está quem o winget não respondeu', async () => {
    await writeFile(file(), JSON.stringify(BUILTIN_CATALOG), 'utf8')
    const antes = (await loadCatalog()).programs.find((p) => p.id === 'go')?.version
    swept = { vim: '9.9.9' }
    await refreshVersionsFromWinget()
    expect(getProgram('go')?.version).toBe(antes)
  })

  it('não avisa ninguém quando não há versão nova', async () => {
    swept = null
    const ouviu = vi.fn()
    const stop = subscribe(ouviu)

    await expect(refreshVersionsFromWinget()).resolves.toBe(false)
    stop()
    expect(ouviu).not.toHaveBeenCalled()
  })

  it('mantém a versão do winget depois de trocar o catálogo', async () => {
    swept = { vim: '9.9.9' }
    await refreshVersionsFromWinget()

    answers({
      version: 1,
      categories: [{ id: 'dev', name: 'DESENVOLVIMENTO' }],
      programs: [
        { id: 'vim', name: 'Vim', winget: 'vim.vim', version: '1.0', mb: 1, category: 'dev', hints: ['vim'] },
      ],
    })
    await refreshCatalog()

    expect(getProgram('vim')?.version).toBe('9.9.9')
  })

  it('não grava a versão dentro do cache do catálogo', async () => {
    answers(remote)
    await refreshCatalog()

    swept = { 'sete-zip': '99.0' }
    await refreshVersionsFromWinget()

    const gravado: unknown = JSON.parse(await readFile(file(), 'utf8'))
    expect(gravado).toMatchObject({ programs: [{ version: '26.02' }] })
    expect(getProgram('sete-zip')?.version).toBe('99.0')
  })
})
