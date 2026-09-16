import { describe, expect, it } from 'vitest'
import { catalogOf } from '@pulse/domain'
import { SAMPLE_BUNDLES, SAMPLE_CATEGORIES, SAMPLE_PROGRAMS } from '@pulse/catalog-data/src/samples'
import type { StartupEntry } from '@pulse/domain'
import { tidyStartup, withPrograms } from './startup'

const SAMPLE_CATALOG = catalogOf(SAMPLE_PROGRAMS, SAMPLE_CATEGORIES, SAMPLE_BUNDLES)

function entry(name: string, over: Partial<StartupEntry> = {}): StartupEntry {
  return { name, value: '', enabled: true, ...over }
}

describe('entradas de inicialização', () => {
  it('o mesmo nome não vira duas linhas', () => {
    const found = tidyStartup([entry('Steam'), entry('steam'), entry('STEAM')])
    expect(found).toHaveLength(1)
  })

  it('a lista sai em ordem que gente lê, sem ligar para maiúscula', () => {
    const found = tidyStartup([entry('zoom'), entry('Adobe'), entry('épico')])
    expect(found.map((e) => e.name)).toEqual(['Adobe', 'épico', 'zoom'])
  })

  it('entrada sem nome não entra', () => {
    expect(tidyStartup([entry('  '), entry('')])).toEqual([])
  })

  it('espaço em volta do nome é aparado', () => {
    expect(tidyStartup([entry('  Steam  ')])[0]?.name).toBe('Steam')
  })

  it('ligado e desligado sobrevivem à limpeza', () => {
    const found = tidyStartup([entry('A', { enabled: false }), entry('B', { enabled: true })])
    expect(found.map((e) => e.enabled)).toEqual([false, true])
  })

  it('o que casa com o catálogo ganha o id do programa', () => {
    const found = withPrograms(SAMPLE_CATALOG, [entry('Steam', { value: 'C:\Steam\steam.exe' })])
    expect(found[0]?.programId).toBe('steam')
  })

  it('o que não casa continua na lista, sem id', () => {
    const found = withPrograms(SAMPLE_CATALOG, [entry('Algum Programa Qualquer')])
    expect(found).toHaveLength(1)
    expect(found[0]?.programId).toBeUndefined()
  })
})
