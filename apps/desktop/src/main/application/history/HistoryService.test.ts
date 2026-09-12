import { describe, expect, it } from 'vitest'
import { HISTORY_LIMIT, type Run, type RunRecord } from '@pulse/domain'
import { HistoryService } from './HistoryService'
import type { HistoryStore } from '../../ports/history-store'

function fakeStore(initial: readonly RunRecord[] = []) {
  let current = initial
  let writes = 0

  const store: HistoryStore = {
    read: async () => current,
    write: async (next) => {
      current = next
      writes++
    },
  }

  return {
    store,
    get current() {
      return current
    },
    get writes() {
      return writes
    },
  }
}

function run(over: Partial<Run> = {}): Run {
  return {
    drive: 'C:',
    startedAt: '2026-09-11T10:00:00.000Z',
    finishedAt: '2026-09-11T10:04:00.000Z',
    canceling: false,
    log: [],
    items: [
      { id: 'chrome', drive: 'C:', status: 'done', percent: 100, detail: '' },
      { id: 'steam', drive: 'D:', status: 'failed', percent: 100, detail: '', error: 'deu ruim' },
    ],
    ...over,
  }
}

describe('HistoryService', () => {
  it('guarda a fila que terminou, com o que aconteceu com cada item', async () => {
    const fake = fakeStore()
    const service = new HistoryService(fake.store)

    await service.onRunChanged(run())

    expect(fake.current).toHaveLength(1)
    expect(fake.current[0]?.items.map((i) => i.status)).toEqual(['done', 'failed'])
    expect(fake.current[0]?.items[1]?.error).toBe('deu ruim')
  })

  it('fila em andamento não vira registro', async () => {
    const fake = fakeStore()
    const service = new HistoryService(fake.store)

    await service.onRunChanged(run({ finishedAt: null }))

    expect(fake.writes).toBe(0)
  })

  // O orquestrador avisa a cada mudança, e uma fila terminada continua
  // terminada em todo aviso seguinte.
  it('a mesma fila não entra duas vezes, por mais avisos que cheguem', async () => {
    const fake = fakeStore()
    const service = new HistoryService(fake.store)

    await service.onRunChanged(run())
    await service.onRunChanged(run())
    await service.onRunChanged(run())

    expect(fake.current).toHaveLength(1)
    expect(fake.writes).toBe(1)
  })

  it('uma fila nova depois da anterior entra, e a mais recente fica na frente', async () => {
    const fake = fakeStore()
    const service = new HistoryService(fake.store)

    await service.onRunChanged(run())
    await service.onRunChanged(run({ startedAt: '2026-09-11T12:00:00.000Z', drive: 'E:' }))

    expect(fake.current).toHaveLength(2)
    expect(fake.current[0]?.drive).toBe('E:')
  })

  it('o arquivo não cresce sem fim', async () => {
    const cheio: RunRecord[] = Array.from({ length: HISTORY_LIMIT }, (_, n) => ({
      startedAt: `2026-01-${String(n + 1).padStart(2, '0')}T00:00:00.000Z`,
      finishedAt: `2026-01-${String(n + 1).padStart(2, '0')}T00:01:00.000Z`,
      drive: 'C:',
      items: [],
    }))
    const fake = fakeStore(cheio)
    const service = new HistoryService(fake.store)

    await service.onRunChanged(run())

    expect(fake.current).toHaveLength(HISTORY_LIMIT)
    expect(fake.current[0]?.drive).toBe('C:')
    expect(fake.current[0]?.items).toHaveLength(2)
  })

  it('limpar esvazia e grava', async () => {
    const fake = fakeStore()
    const service = new HistoryService(fake.store)

    await service.onRunChanged(run())
    expect(await service.clear()).toEqual([])
    expect(fake.current).toEqual([])
  })
})
