import { describe, expect, it } from 'vitest'
import { CATALOG } from '@pulse/catalog-data'
import {
  listStepFor,
  listValue,
  STEPS,
  STEP_BY_ID,
  stepsAreEmpty,
  stepsFor,
  stepsSummary,
  withListValue,
  type Steps,
} from './index'

describe('registro de steps', () => {
  it('todo step do registro é alcançável pelo id', () => {
    for (const step of STEPS) expect(STEP_BY_ID.get(step.id)).toBe(step)
  })

  it('todo programa do catálogo com ajuste declara um step conhecido', () => {
    for (const program of CATALOG) {
      if (!program.settingsKind) continue
      expect(stepsFor(program).length, `${program.id} ficou sem step`).toBeGreaterThan(0)
    }
  })

  it('um programa sem ajuste não tem step', () => {
    expect(stepsFor({ id: 'chrome' })).toEqual([])
  })

  it('vazio é vazio, e valor preenchido não é', () => {
    expect(stepsAreEmpty(undefined)).toBe(true)
    expect(stepsAreEmpty({})).toBe(true)
    expect(stepsAreEmpty({ vscodeExtensions: [] })).toBe(true)
    expect(stepsAreEmpty({ browserDefault: {} })).toBe(true)
    expect(stepsAreEmpty({ browserDefault: { makeDefault: false } })).toBe(true)
    expect(stepsAreEmpty({ vscodeExtensions: ['a'] })).toBe(false)
    expect(stepsAreEmpty({ browserDefault: { makeDefault: true } })).toBe(false)
  })

  it('o resumo sai na ordem do registro e ignora o que está vazio', () => {
    const steps: Steps = {
      vscodeExtensions: ['a', 'b'],
      steamGames: [],
      riotProducts: ['lol'],
      gitConfig: { name: 'Wesley', email: 'w@x.com', branch: 'main', saveLogin: true },
      browserDefault: { makeDefault: true },
    }

    expect(stepsSummary(steps)).toEqual([
      '2 extensões',
      '1 jogo da Riot',
      'Git configurado',
      'login do GitHub guardado',
      'navegador padrão',
    ])
  })

  it('singular e plural mudam com a contagem', () => {
    expect(stepsSummary({ vscodeExtensions: ['a'] })).toEqual(['1 extensão'])
    expect(stepsSummary({ tibiaPages: ['a', 'b'] })).toEqual(['2 clientes'])
  })

  it('a Steam resume por nome até dois jogos e por contagem acima disso', () => {
    const game = (appid: string, name: string) => ({ appid, name })
    expect(stepsSummary({ steamGames: [game('1', 'Dota')] })).toEqual(['Dota'])
    expect(stepsSummary({ steamGames: [game('1', 'Dota'), game('2', 'CS')] })).toEqual(['Dota e CS'])
    expect(
      stepsSummary({ steamGames: [game('1', 'A'), game('2', 'B'), game('3', 'C')] }),
    ).toEqual(['3 jogos'])
  })

  it('o schema recusa valor fora do formato do step', () => {
    expect(STEP_BY_ID.get('vscodeExtensions')?.schema.safeParse(['ok']).success).toBe(true)
    expect(STEP_BY_ID.get('vscodeExtensions')?.schema.safeParse('nao').success).toBe(false)
  })
})

describe('step de lista', () => {
  it('cada tipo que marca opções aponta para o seu step', () => {
    expect(listStepFor('vscode')?.id).toBe('vscodeExtensions')
    expect(listStepFor('tibia')?.id).toBe('tibiaPages')
    expect(listStepFor('riot')?.id).toBe('riotProducts')
    expect(listStepFor('vs')?.id).toBe('vsWorkloads')
  })

  it('tipo sem lista para marcar não tem step de lista', () => {
    expect(listStepFor('git')).toBeUndefined()
    expect(listStepFor('steam')).toBeUndefined()
    expect(listStepFor('browser')).toBeUndefined()
    expect(listStepFor(undefined)).toBeUndefined()
  })

  it('todo step de lista tem opções e texto de busca', () => {
    for (const kind of ['vscode', 'tibia', 'riot', 'vs'] as const) {
      const step = listStepFor(kind)
      expect(step?.options?.length, `${kind} sem opções`).toBeGreaterThan(0)
      expect(step?.searchPlaceholder, `${kind} sem texto de busca`).toBeTruthy()
    }
  })

  it('ler e escrever o valor passa pelo id do step, não pelo nome do campo', () => {
    const step = listStepFor('tibia')
    if (!step) throw new Error('esperava o step do Tibia')

    expect(listValue(undefined, step)).toEqual([])
    expect(listValue({}, step)).toEqual([])

    const written = withListValue({ vscodeExtensions: ['x'] }, step, ['a', 'b'])
    expect(written.tibiaPages).toEqual(['a', 'b'])
    expect(written.vscodeExtensions).toEqual(['x'])
    expect(listValue(written, step)).toEqual(['a', 'b'])
  })

  it('sem step, ler devolve lista vazia em vez de estourar', () => {
    expect(listValue({ tibiaPages: ['a'] }, undefined)).toEqual([])
  })
})
