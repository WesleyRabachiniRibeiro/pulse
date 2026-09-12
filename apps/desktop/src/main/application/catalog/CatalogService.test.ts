import { LiveCatalog } from './LiveCatalog'
import { describe, expect, it } from 'vitest'
import type { ProcessRunner, SpawnResult } from '../../ports/process-runner'
import type { CatalogPackageReader } from '../../ports/catalog-package-reader'
import type { AutostartReader } from '../../ports/autostart-reader'
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
    )
    expect(await service.listInstalled(false)).toEqual(['chrome', 'vscode'])
  })
})
