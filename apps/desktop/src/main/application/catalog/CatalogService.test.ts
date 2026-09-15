import { LiveCatalog } from './LiveCatalog'
import { describe, expect, it } from 'vitest'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'
import type { CatalogPackageReader } from '../../ports/catalog-package-reader'
import type { AutostartReader } from '../../ports/autostart-reader'
import type { Program } from '@pulse/domain'
import { CatalogService } from './CatalogService'

function fakeProcessRunner(text: string): ProcessRunner {
  return {
    runOnce: async (): Promise<SpawnResult> => ({ code: 0, text }),
    runWinget: async () => ({ code: 0, text: '' }),
    killWinget: () => {},
    run: async () => true,
    launchDetached: async () => {},
    runCommandLine: async () => true,
    openUri: async () => true,
    runElevated: async () => ({ code: 0, text: '' }),
    runAsInteractiveUser: async () => ({ code: 0, text: '' }),
    isElevated: async () => false,
  }
}

function fakePackageReader(ids: string[] = []): CatalogPackageReader {
  return { listUpgrades: async () => [],
    listInstalled: async () => ids }
}

function fakeAutostartReader(): AutostartReader {
  return { list: async () => [] }
}

const WINGET_SEARCH_OUTPUT = `
Nome                             ID                          Versão   Origem
-------------------------------------------------------------------------------
Node.js                          OpenJS.NodeJS.LTS           22.11.0  winget
Node.js                          OpenJS.NodeJS               23.3.0   winget
Node.js (16)                     OpenJS.NodeJS.16             16.20.2 winget
`

function fakeRegistry() {
  return { listEntries: async () => [] }
}

function fakeStartup() {
  return { list: async () => [], set: async () => {} }
}

function fakeFinder(found: { winget: string; name: string; version: string } | null = null) {
  return { search: async () => found }
}

function adopting(found: { winget: string; name: string; version: string } | null) {
  const written: Program[][] = []
  const service = new CatalogService(
    new LiveCatalog(),
    fakePackageReader(),
    fakeAutostartReader(),
    fakeProcessRunner(''),
    fakeStartup(),
    fakeRegistry(),
    { read: async () => null, write: async () => {} },
    { text: async () => null },
    'https://example.test/catalog.json',
    {
      read: async () => [],
      write: async (programs) => {
        written.push([...programs])
      },
    },
    fakeFinder(found),
  )
  return { service, written }
}

const STEAM = { winget: 'Valve.Steam', name: 'Steam', version: '2.10.91' }
const DROPBOX = { winget: 'Dropbox.Dropbox', name: 'Dropbox', version: '1.0' }

describe('adotar um programa do PC', () => {
  it('o que o winget não conhece não entra', async () => {
    const { service, written } = adopting(null)

    expect(await service.adoptProgram({ name: 'Coisa Caseira' })).toEqual({
      status: 'not-found',
    })
    expect(written).toEqual([])
  })

  // O id sai do id do winget para que dois PCs que adotem o mesmo programa
  // cheguem ao mesmo id, e um perfil de um funcione no outro.
  it('entra com id derivado do winget e na categoria de quem adotou', async () => {
    const { service, written } = adopting(DROPBOX)

    expect(await service.adoptProgram({ name: 'Dropbox' })).toEqual({
      status: 'added',
      id: 'dropbox-dropbox',
    })

    const saved = written[0]?.[0]
    expect(saved?.winget).toBe('Dropbox.Dropbox')
    expect(saved?.category).toBe('mine')
    expect(saved?.hints).toEqual(['dropbox'])
  })

  it('a versão do PC ganha da que o winget publica', async () => {
    const { service, written } = adopting(DROPBOX)
    await service.adoptProgram({ name: 'Dropbox', version: '9.9.9' })
    expect(written[0]?.[0]?.version).toBe('9.9.9')
  })

  it('o ícone entra quando veio, e some quando não veio', async () => {
    const withIcon = adopting(DROPBOX)
    await withIcon.service.adoptProgram({ name: 'Dropbox', icon: 'data:image/png;base64,x' })
    expect(withIcon.written[0]?.[0]?.icon).toBe('data:image/png;base64,x')

    const without = adopting(DROPBOX)
    await without.service.adoptProgram({ name: 'Dropbox' })
    expect(without.written[0]?.[0]).not.toHaveProperty('icon')
  })

  // O publicado manda, e ele é achado pelo id do winget: o Steam do catálogo
  // se chama 'steam', enquanto o id derivado seria 'valve-steam'.
  it('quem já está no catálogo publicado é recusado', async () => {
    const { service, written } = adopting(STEAM)

    expect(await service.adoptProgram({ name: 'Steam' })).toEqual({
      status: 'exists',
      id: 'steam',
    })
    expect(written).toEqual([])
  })

  it('adotar duas vezes não duplica', async () => {
    const { service, written } = adopting(DROPBOX)

    await service.adoptProgram({ name: 'Dropbox' })
    expect(await service.adoptProgram({ name: 'Dropbox' })).toEqual({
      status: 'exists',
      id: 'dropbox-dropbox',
    })
    expect(written.length).toBe(1)
  })
})

describe('CatalogService.listVersions', () => {
  it('returns an empty list for a program with no family', async () => {
    const service = new CatalogService(
      new LiveCatalog(),
      fakePackageReader(),
      fakeAutostartReader(),
      fakeProcessRunner(''),
      fakeStartup(),
      fakeRegistry(),
      { read: async () => null, write: async () => {} },
      { text: async () => null },
      'https://example.test/catalog.json',
      { read: async () => [], write: async () => {} },
      fakeFinder(),
    )
    expect(await service.listVersions('chrome')).toEqual([])
  })

  it('parses the winget search table and sorts versions descending', async () => {
    const service = new CatalogService(
      new LiveCatalog(),
      fakePackageReader(),
      fakeAutostartReader(),
      fakeProcessRunner(WINGET_SEARCH_OUTPUT),
      fakeStartup(),
      fakeRegistry(),
      { read: async () => null, write: async () => {} },
      { text: async () => null },
      'https://example.test/catalog.json',
      { read: async () => [], write: async () => {} },
      fakeFinder(),
    )
    const versions = await service.listVersions('node')
    // OpenJS.NodeJS.LTS ganha por ser tratado como "sempre a mais nova"; entre
    // as outras duas, o ID sem número cai para os dígitos da versão (23.3.0),
    // que supera o "16" extraído do ID de OpenJS.NodeJS.16.
    expect(versions.map((v) => v.winget)).toEqual([
      'OpenJS.NodeJS.LTS',
      'OpenJS.NodeJS',
      'OpenJS.NodeJS.16',
    ])
  })

  it('flags the catalog default winget id as recommended', async () => {
    const service = new CatalogService(
      new LiveCatalog(),
      fakePackageReader(),
      fakeAutostartReader(),
      fakeProcessRunner(WINGET_SEARCH_OUTPUT),
      fakeStartup(),
      fakeRegistry(),
      { read: async () => null, write: async () => {} },
      { text: async () => null },
      'https://example.test/catalog.json',
      { read: async () => [], write: async () => {} },
      fakeFinder(),
    )
    const versions = await service.listVersions('node')
    const recommended = versions.find((v) => v.recommended)
    expect(recommended?.winget).toBe('OpenJS.NodeJS.LTS')
  })
})

describe('CatalogService passthroughs', () => {
  it('delegates listInstalled to the package reader', async () => {
    const service = new CatalogService(
      new LiveCatalog(),
      fakePackageReader(['chrome', 'vscode']),
      fakeAutostartReader(),
      fakeProcessRunner(''),
      fakeStartup(),
      fakeRegistry(),
      { read: async () => null, write: async () => {} },
      { text: async () => null },
      'https://example.test/catalog.json',
      { read: async () => [], write: async () => {} },
      fakeFinder(),
    )
    expect(await service.listInstalled(false)).toEqual(['chrome', 'vscode'])
  })
})
