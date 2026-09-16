import { describe, expect, it } from 'vitest'
import { EMPTY_PROFILE, SEED_CATALOG, type Profile } from '@pulse/domain'
import { portableOf } from '@pulse/utils'
import { ProfileService } from './ProfileService'
import type { FileDialog, SaveRequest } from '../../ports/file-dialog'
import type { RemoteFetch } from '../../ports/remote-fetch'

const mine: Profile = {
  selected: ['chrome', 'steam'],
  drives: {},
  settings: {},
}

function make(
  over: {
    dialog?: Partial<FileDialog>
    remote?: Partial<RemoteFetch>
    folder?: string
  } = {},
) {
  const saved: SaveRequest[] = []

  const dialog: FileDialog = {
    save: async (request) => {
      saved.push(request)
      return { outcome: 'saved', path: `C:\\${request.suggestedName}.${request.extension}` }
    },
    openText: async () => null,
    pickFolder: async () => null,
    ...over.dialog,
  }

  const remote: RemoteFetch = { text: async () => null, ...over.remote }

  const service = new ProfileService(SEED_CATALOG, dialog, remote, { list: async () => [] }, async () =>
    over.folder,
  )

  return { saved, service }
}

describe('exportar', () => {
  it('cada formato leva a sua extensão e o seu nome de filtro', async () => {
    const { saved, service } = make()

    await service.export('pulse', mine)
    await service.export('script', mine)
    await service.export('csv', mine)

    expect(saved.map((r) => r.extension)).toEqual(['json', 'ps1', 'csv'])
    expect(saved[1]?.filterName).toBe('Script do PowerShell')
  })

  it('devolve o caminho de quem gravou', async () => {
    const { service } = make()
    const result = await service.export('pulse', mine)

    expect(result.status).toBe('saved')
    expect(result.path).toContain('.json')
  })

  it('fechar a janela não é falha', async () => {
    const { service } = make({ dialog: { save: async () => ({ outcome: 'canceled' }) } })
    expect((await service.export('pulse', mine)).status).toBe('canceled')
  })
})

describe('importar de arquivo', () => {
  const file = JSON.stringify(portableOf(mine))

  it('traz a seleção e conta quantos entraram', async () => {
    const { service } = make({
      dialog: { openText: async () => ({ path: 'p.json', contents: file }) },
    })

    const result = await service.import('replace', EMPTY_PROFILE)

    expect(result.status).toBe('imported')
    expect(result.count).toBe(2)
    expect(result.profile?.selected).toEqual(['chrome', 'steam'])
  })

  it('cancelar não é erro nem mexe no que estava', async () => {
    const { service } = make()
    const result = await service.import('merge', EMPTY_PROFILE)

    expect(result.status).toBe('canceled')
    expect(result.profile).toBeUndefined()
  })

  it('arquivo que não é JSON é recusado sem estourar', async () => {
    const { service } = make({
      dialog: { openText: async () => ({ path: 'p.json', contents: 'nada disso' }) },
    })
    expect((await service.import('merge', EMPTY_PROFILE)).status).toBe('invalid')
  })

  it('JSON válido de outro programa é recusado', async () => {
    const { service } = make({
      dialog: { openText: async () => ({ path: 'p.json', contents: '{"outro":true}' }) },
    })
    expect((await service.import('merge', EMPTY_PROFILE)).status).toBe('invalid')
  })

  it('programa fora do catálogo não entra, e é relatado', async () => {
    const alheio = JSON.stringify(
      portableOf({ selected: ['chrome', 'aposentado'], drives: {}, settings: {} }),
    )
    const { service } = make({
      dialog: { openText: async () => ({ path: 'p.json', contents: alheio }) },
    })

    const result = await service.import('replace', EMPTY_PROFILE)

    expect(result.profile?.selected).toEqual(['chrome'])
    expect(result.missing).toEqual(['aposentado'])
  })
})

describe('importar de link', () => {
  it('link que não respondeu vira falha, não exceção', async () => {
    const { service } = make()
    expect((await service.importLink('http://x', 'merge', EMPTY_PROFILE)).status).toBe('failed')
  })

  it('link que respondeu é tratado igual a um arquivo', async () => {
    const { service } = make({
      remote: { text: async () => JSON.stringify(portableOf(mine)) },
    })

    const result = await service.importLink('https://x/p.json', 'replace', EMPTY_PROFILE)

    expect(result.status).toBe('imported')
    expect(result.count).toBe(2)
  })
})

describe('pasta sincronizada', () => {
  it('a pasta escolhida vira o ponto de partida do salvar', async () => {
    const { saved, service } = make({ folder: 'D:\Sync' })
    await service.export('pulse', mine)
    expect(saved[0]?.startIn).toBe('D:\Sync')
  })

  it('sem pasta escolhida, a janela não recebe ponto de partida', async () => {
    const { saved, service } = make()
    await service.export('pulse', mine)
    expect(saved[0]?.startIn).toBeUndefined()
  })

  it('abrir também começa na pasta', async () => {
    let seen: string | undefined = 'nao-perguntado'
    const { service } = make({
      folder: 'D:\Sync',
      dialog: {
        openText: async (_name, _ext, startIn) => {
          seen = startIn
          return null
        },
      },
    })

    await service.import('merge', mine)
    expect(seen).toBe('D:\Sync')
  })
})
