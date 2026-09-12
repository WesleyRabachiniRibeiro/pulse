import { describe, expect, it } from 'vitest'
import { ERROR_LIMIT, type Run, type RunRecord } from '@pulse/domain'
import { installedCount, recordOf, runSeconds, tallyOf, withRecord } from './history'

function run(over: Partial<Run> = {}): Run {
  return {
    drive: 'C:',
    startedAt: '2026-09-11T10:00:00.000Z',
    finishedAt: '2026-09-11T10:04:00.000Z',
    canceling: false,
    log: [],
    items: [
      { id: 'chrome', drive: 'C:', status: 'done', percent: 100, detail: '' },
      { id: 'firefox', drive: 'C:', status: 'done', percent: 100, detail: '' },
      { id: 'steam', drive: 'D:', status: 'failed', percent: 100, detail: '' },
    ],
    ...over,
  }
}

describe('registro de uma fila', () => {
  it('fila sem fim não vira registro', () => {
    expect(recordOf(run({ finishedAt: null }))).toBeNull()
  })

  it('guarda o disco de cada item, que pode ser outro', () => {
    const record = recordOf(run())
    expect(record?.items.map((i) => i.drive)).toEqual(['C:', 'C:', 'D:'])
  })

  // Algumas mensagens do winget vêm com um despejo inteiro dentro.
  it('mensagem de erro comprida é cortada', () => {
    const record = recordOf(
      run({
        items: [
          { id: 'x', drive: 'C:', status: 'failed', percent: 100, detail: '', error: 'e'.repeat(1000) },
        ],
      }),
    )
    expect(record?.items[0]?.error).toHaveLength(ERROR_LIMIT)
  })

  it('o log da fila não vai junto', () => {
    const record = recordOf(run())
    expect(JSON.stringify(record)).not.toContain('log')
  })
})

describe('leitura do histórico', () => {
  const record = recordOf(run()) as RunRecord

  it('conta quantos ficaram prontos', () => {
    expect(installedCount(record)).toBe(2)
  })

  it('resume por situação, sem listar as que não aconteceram', () => {
    expect(tallyOf(record)).toEqual([
      { state: 'done', count: 2 },
      { state: 'failed', count: 1 },
    ])
  })

  it('diz quanto tempo a fila levou', () => {
    expect(runSeconds(record)).toBe(240)
  })

  it('data inválida devolve zero em vez de NaN na tela', () => {
    expect(runSeconds({ ...record, finishedAt: 'nada' })).toBe(0)
  })

  it('o mais recente entra na frente', () => {
    const older: RunRecord = { ...record, drive: 'Z:' }
    expect(withRecord([older], record)[0]?.drive).toBe('C:')
  })
})
