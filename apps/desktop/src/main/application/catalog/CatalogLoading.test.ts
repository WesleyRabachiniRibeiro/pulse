import { describe, expect, it } from 'vitest'
import {
  CATALOG_VERSION,
  SEED_CATALOG,
  type CatalogPayload,
  type CatalogState,
  type Program,
} from '@pulse/domain'
import { CatalogService } from './CatalogService'
import { LiveCatalog } from './LiveCatalog'
import type { CatalogCache } from '../../ports/catalog-cache'
import type { RemoteFetch } from '../../ports/remote-fetch'

function payload(over: Partial<CatalogPayload> = {}): CatalogPayload {
  return {
    pulse: CATALOG_VERSION,
    categories: [{ id: 'dev', name: 'DESENVOLVIMENTO' }],
    programs: [
      { id: 'novo', name: 'Programa Novo', version: '1.0', mb: 10, category: 'dev', hints: ['novo'] },
    ],
    bundles: [],
    ...over,
  }
}

function make(
  over: { cached?: CatalogPayload | null; body?: string | null; extras?: Program[] } = {},
) {
  const catalog = new LiveCatalog()
  const written: CatalogPayload[] = []
  const states: CatalogState[] = []

  const cache: CatalogCache = {
    read: async () => over.cached ?? null,
    write: async (p) => {
      written.push(p)
    },
  }
  const remote: RemoteFetch = { text: async () => over.body ?? null }

  const service = new CatalogService(
    catalog,
    { listInstalled: async () => [], listUpgrades: async () => [] },
    { list: async () => [] },
    {
      runOnce: async () => ({ code: 0, text: '' }),
      runWinget: async () => ({ code: 0, text: '' }),
      killWinget: () => {},
      run: async () => true,
      launchDetached: async () => {},
      runCommandLine: async () => true,
      openUri: async () => true,
      runElevated: async () => ({ code: 0, text: '' }),
      runAsInteractiveUser: async () => ({ code: 0, text: '' }),
      isElevated: async () => false,
    },
    { list: async () => [], set: async () => {} },
    { listEntries: async () => [] },
    cache,
    remote,
    'https://example.test/catalog.json',
    { read: async () => over.extras ?? [], write: async () => {} },
    { search: async () => null },
  )

  service.subscribe((state) => states.push(state))
  return { catalog, service, written, states }
}

describe('de onde vem o catálogo', () => {
  it('sem cache e sem rede, fica na semente', async () => {
    const { catalog, service } = make()

    await service.load()

    expect(service.currentState().source).toBe('seed')
    expect(catalog.programs).toEqual(SEED_CATALOG.programs)
  })

  it('a rede, quando responde, substitui e é guardada', async () => {
    const { catalog, service, written } = make({ body: JSON.stringify(payload()) })

    await service.load()

    expect(service.currentState().source).toBe('network')
    expect(catalog.byId.get('novo')?.name).toBe('Programa Novo')
    expect(written).toHaveLength(1)
  })

  it('o cache entra primeiro, e a rede passa por cima', async () => {
    const cached = payload({
      programs: [
        { id: 'velho', name: 'Do Cache', version: '1', mb: 1, category: 'dev', hints: ['velho'] },
      ],
    })
    const { catalog, service, states } = make({ cached, body: JSON.stringify(payload()) })

    await service.load()

    expect(states.map((s) => s.source)).toEqual(['seed', 'cache', 'network'])
    expect(catalog.byId.has('novo')).toBe(true)
  })

  it('rede fora mantém o cache que já tinha entrado', async () => {
    const cached = payload()
    const { catalog, service } = make({ cached })

    await service.load()

    expect(service.currentState().source).toBe('cache')
    expect(catalog.byId.has('novo')).toBe(true)
  })

  it('resposta que não é catálogo não substitui nada, e não é guardada', async () => {
    const { catalog, service, written } = make({ body: '{"qualquer":true}' })

    await service.load()

    expect(service.currentState().source).toBe('seed')
    expect(catalog.programs).toEqual(SEED_CATALOG.programs)
    expect(written).toEqual([])
  })

  it('resposta que não é JSON não estoura', async () => {
    const { service } = make({ body: 'isto não é json' })

    await expect(service.load()).resolves.toBeUndefined()
    expect(service.currentState().source).toBe('seed')
  })

  it('catálogo com id repetido é recusado inteiro', async () => {
    const broken = payload({
      programs: [
        { id: 'x', name: 'A', version: '1', mb: 1, category: 'dev', hints: [] },
        { id: 'x', name: 'B', version: '1', mb: 1, category: 'dev', hints: [] },
      ],
    })
    const { service } = make({ body: JSON.stringify(broken) })

    await service.load()

    expect(service.currentState().source).toBe('seed')
  })

  it('catálogo com padrão de família inválido é recusado inteiro', async () => {
    const broken = payload({
      programs: [
        {
          id: 'x',
          name: 'A',
          version: '1',
          mb: 1,
          category: 'dev',
          hints: [],
          family: { prefix: 'A', pattern: '([' },
        },
      ],
    })
    const { service } = make({ body: JSON.stringify(broken) })

    await service.load()

    expect(service.currentState().source).toBe('seed')
  })

  it('catálogo de outra versão do formato é recusado', async () => {
    const { service } = make({ body: JSON.stringify(payload({ pulse: 99 })) })

    await service.load()

    expect(service.currentState().source).toBe('seed')
  })
})
