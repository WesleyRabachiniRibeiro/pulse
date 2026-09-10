import { describe, expect, it } from 'vitest'
import {
  canEnqueue,
  hasSettings,
  readProgress,
  requestChanged,
  requestsToAppend,
  type Item,
  type Request,
  type Run,
} from './installation'
import type { Settings } from './settings'

function done(id: string, settings?: Settings, drive = 'C:'): Item {
  return { id, status: 'done', percent: 100, detail: 'pronto', drive, settings }
}

function request(id: string, settings?: Settings, drive = 'C:'): Request {
  return { id, drive, ...(settings ? { settings } : {}) }
}

describe('requestChanged', () => {
  it('vê a troca de disco', () => {
    expect(requestChanged(request('vscode', undefined, 'D:'), done('vscode'))).toBe(true)
  })

  it('vê a troca de versão do pacote', () => {
    const antes = done('node', { packageId: 'OpenJS.NodeJS.LTS' })
    expect(requestChanged(request('node', { packageId: 'OpenJS.NodeJS.22' }), antes)).toBe(true)
  })

  it('vê a escolha de autostart', () => {
    expect(requestChanged(request('discord', { autostart: false }), done('discord'))).toBe(true)
  })

  it('vê a troca de autostart ligado para desligado', () => {
    const antes = done('discord', { autostart: true })
    expect(requestChanged(request('discord', { autostart: false }), antes)).toBe(true)
  })

  it('não reclama quando nada mudou', () => {
    const settings: Settings = { steps: { vscodeExtensions: ['a', 'b'] }, autostart: true }
    const antes = done('vscode', { steps: { vscodeExtensions: ['b', 'a'] }, autostart: true })
    expect(requestChanged(request('vscode', settings), antes)).toBe(false)
  })

  it('trata ausente e vazio como iguais', () => {
    expect(requestChanged(request('vim', {}), done('vim'))).toBe(false)
  })
})

describe('canEnqueue', () => {
  it('deixa entrar programa que nunca passou pela fila', () => {
    expect(canEnqueue(undefined)).toBe(true)
  })

  it('barra quem ainda está na fila', () => {
    const queued: Item = { id: 'vim', status: 'queued', percent: 0, detail: '', drive: 'C:' }
    expect(canEnqueue(queued, request('vim'))).toBe(false)
  })

  it('deixa repetir quem falhou', () => {
    const failed: Item = { id: 'vim', status: 'failed', percent: 0, detail: '', drive: 'C:' }
    expect(canEnqueue(failed, request('vim'))).toBe(true)
  })

  it('deixa aplicar de novo quando só a versão mudou', () => {
    const antes = done('node', { packageId: 'OpenJS.NodeJS.LTS' })
    expect(canEnqueue(antes, request('node', { packageId: 'OpenJS.NodeJS.22' }))).toBe(true)
  })

  it('deixa aplicar de novo quando só o autostart mudou', () => {
    expect(canEnqueue(done('discord'), request('discord', { autostart: false }))).toBe(true)
  })

  it('recusa quando o pedido é idêntico ao que já rodou', () => {
    const antes = done('discord', { autostart: false })
    expect(canEnqueue(antes, request('discord', { autostart: false }))).toBe(false)
  })
})

describe('requestsToAppend', () => {
  const run: Run = {
    items: [done('node', { packageId: 'OpenJS.NodeJS.LTS' }), done('vim')],
    drive: 'C:',
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    canceling: false,
    log: [],
  }

  it('deixa passar só o que mudou', () => {
    const pedidos = [
      request('node', { packageId: 'OpenJS.NodeJS.22' }),
      request('vim'),
      request('go'),
    ]
    expect(requestsToAppend(pedidos, run).map((r) => r.id)).toEqual(['node', 'go'])
  })

  it('deixa tudo passar quando não há fila', () => {
    expect(requestsToAppend([request('vim')], null)).toHaveLength(1)
  })
})

describe('hasSettings', () => {
  it('enxerga a versão escolhida', () => {
    expect(hasSettings(done('node', { packageId: 'OpenJS.NodeJS.22' }))).toBe(true)
  })

  it('enxerga o autostart desligado', () => {
    expect(hasSettings(done('discord', { autostart: false }))).toBe(true)
  })

  it('não enxerga ajuste onde não há', () => {
    expect(hasSettings(done('vim'))).toBe(false)
    expect(hasSettings(done('vim', { steps: { vscodeExtensions: [] } }))).toBe(false)
  })
})

describe('readProgress', () => {
  it('lê o percentual de uma linha com bytes', () => {
    expect(readProgress('  50.0 MB / 100.0 MB').percent).toBe(50)
  })

  it('aceita vírgula decimal', () => {
    expect(readProgress('  2,5 MB / 10,0 MB').percent).toBe(25)
  })

  it('assume a unidade do total quando falta na primeira parte', () => {
    expect(readProgress('  512 / 1024 KB').percent).toBe(50)
  })

  it('reconhece a fase em português e em inglês', () => {
    expect(readProgress('Baixando pacote').phase).toBe('downloading')
    expect(readProgress('Downloading package').phase).toBe('downloading')
    expect(readProgress('Instalando...').phase).toBe('installing')
    expect(readProgress('Installing...').phase).toBe('installing')
  })

  it('devolve vazio quando não há nada para ler', () => {
    expect(readProgress('linha qualquer')).toEqual({})
  })
})
