import { describe, expect, it } from 'vitest'
import {
  ERROR_LIMIT,
  HISTORY_LIMIT,
  historySchema,
  installedCount,
  recordOf,
  withRecord,
  type RunRecord,
} from './history'
import type { Item, Run } from './installation'

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'chrome',
    status: 'done',
    percent: 100,
    detail: 'Pronto',
    drive: 'D:',
    ...over,
  }
}

function run(over: Partial<Run> = {}): Run {
  return {
    items: [item()],
    drive: 'D:',
    startedAt: '2026-09-09T10:00:00.000Z',
    finishedAt: '2026-09-09T10:04:00.000Z',
    canceling: false,
    log: [{ time: '00:00', text: 'fila com 1 programas', level: 'step' }],
    ...over,
  }
}

function record(over: Partial<RunRecord> = {}): RunRecord {
  return {
    startedAt: '2026-09-09T10:00:00.000Z',
    finishedAt: '2026-09-09T10:04:00.000Z',
    drive: 'D:',
    items: [{ id: 'chrome', status: 'done', drive: 'D:' }],
    ...over,
  }
}

describe('recordOf', () => {
  it('não guarda fila que ainda está andando', () => {
    expect(recordOf(run({ finishedAt: null }))).toBeNull()
  })

  it('guarda o essencial de cada item e joga fora o andamento', () => {
    const saved = recordOf(run())

    expect(saved).toEqual({
      startedAt: '2026-09-09T10:00:00.000Z',
      finishedAt: '2026-09-09T10:04:00.000Z',
      drive: 'D:',
      items: [{ id: 'chrome', status: 'done', drive: 'D:' }],
    })
  })

  it('não guarda o log da fila', () => {
    expect(JSON.stringify(recordOf(run()))).not.toContain('fila com 1 programas')
  })

  it('corta erro comprido de instalador', () => {
    const saved = recordOf(
      run({ items: [item({ status: 'failed', error: 'x'.repeat(ERROR_LIMIT + 200) })] }),
    )

    expect(saved?.items[0]?.error).toHaveLength(ERROR_LIMIT)
  })

  it('omite o erro quando não houve', () => {
    expect(recordOf(run())?.items[0]).not.toHaveProperty('error')
  })

  it('guarda o disco de cada item, que pode fugir do disco da fila', () => {
    const saved = recordOf(run({ items: [item({ drive: 'C:' })] }))
    expect(saved?.items[0]?.drive).toBe('C:')
  })

  it('sai no formato que o contrato aceita', () => {
    expect(historySchema.safeParse([recordOf(run())]).success).toBe(true)
  })
})

describe('withRecord', () => {
  it('põe a fila mais nova na frente', () => {
    const older = record({ finishedAt: '2026-09-01T10:00:00.000Z' })
    const newer = record({ finishedAt: '2026-09-09T10:00:00.000Z' })

    expect(withRecord([older], newer).map((r) => r.finishedAt)).toEqual([
      '2026-09-09T10:00:00.000Z',
      '2026-09-01T10:00:00.000Z',
    ])
  })

  it('para de crescer no limite, descartando a mais velha', () => {
    const full = Array.from({ length: HISTORY_LIMIT }, (_, i) =>
      record({ startedAt: `antiga-${i}` }),
    )
    const next = withRecord(full, record({ startedAt: 'nova' }))

    expect(next).toHaveLength(HISTORY_LIMIT)
    expect(next[0]?.startedAt).toBe('nova')
    expect(next.at(-1)?.startedAt).toBe(`antiga-${HISTORY_LIMIT - 2}`)
  })

  it('não mexe na lista que recebeu', () => {
    const before = [record()]
    withRecord(before, record({ startedAt: 'nova' }))
    expect(before).toHaveLength(1)
  })
})

describe('installedCount', () => {
  it('conta só o que ficou pronto', () => {
    const saved = record({
      items: [
        { id: 'chrome', status: 'done', drive: 'D:' },
        { id: 'steam', status: 'failed', drive: 'D:' },
        { id: 'vscode', status: 'canceled', drive: 'D:' },
      ],
    })

    expect(installedCount(saved)).toBe(1)
  })
})
